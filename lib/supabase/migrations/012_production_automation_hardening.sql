-- I AM NOBODY Image Studio
-- Migration 012: production-only automated generation, final rate limits,
-- and activation hardening. Run after migration 011.

begin;

do $$
begin
  if to_regclass('public.daily_artwork_automation') is null
     or to_regclass('public.daily_artwork_items') is null
     or to_regclass('public.artwork_certificates') is null then
    raise exception 'Migration 011 must be applied before migration 012.';
  end if;
end;
$$;

update public.image_generation_policy
set
  is_enabled = true,
  automated_review_enabled = true,
  max_images_per_job = 1,
  max_images_per_hour = 15,
  max_images_per_day = 25,
  max_images_per_month = 500,
  max_high_quality_images_per_day = 5,
  max_concurrent_jobs = 3,
  cooldown_seconds = 0,
  active_job_ttl_minutes = 20,
  max_reserved_cost_usd_per_month = 100.00,
  updated_at = timezone('utc', now())
where singleton = true;

update public.daily_artwork_automation
set
  is_enabled = true,
  timezone = 'Europe/Rome',
  local_hour = 10,
  daily_count = 10,
  quality = 'medium',
  background_variant = 'canonical-taupe',
  actor_user_id = coalesce(
    actor_user_id,
    (
      select user_id
      from public.studio_admins
      where is_active = true
        and role in ('owner', 'editor')
      order by case role when 'owner' then 0 else 1 end, created_at
      limit 1
    )
  ),
  planner_model = 'gpt-5.6-luna',
  planner_history_limit = 180,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'production_mode', true,
    'manual_generation_enabled', false,
    'human_approval_required', true,
    'daily_count', 10,
    'schedule', '10:00 Europe/Rome',
    'fixed_background', 'IAMN-BACKGROUND-CANONICAL-001',
    'fixed_template', true
  ),
  updated_at = timezone('utc', now())
where singleton = true;

do $$
begin
  if not exists (
    select 1
    from public.image_generation_policy
    where singleton = true
  ) then
    raise exception 'The image-generation policy row is missing.';
  end if;

  if not exists (
    select 1
    from public.daily_artwork_automation
    where singleton = true
  ) then
    raise exception 'The daily automation configuration row is missing.';
  end if;

  if exists (
    select 1
    from public.daily_artwork_automation
    where singleton = true and actor_user_id is null
  ) then
    raise exception 'An active Studio owner or editor is required for daily automation.';
  end if;
end;
$$;

create or replace function public.enforce_automated_generation_source()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.source is distinct from 'daily_automation'
     and new.source is distinct from 'regeneration' then
    raise exception 'New artwork generation is restricted to daily automation and review-based regeneration.'
      using errcode = 'P0001';
  end if;

  if new.number_of_variations is distinct from 1 then
    raise exception 'Production generation jobs must create exactly one artwork.'
      using errcode = 'P0001';
  end if;

  if new.background_variant is distinct from 'canonical-taupe' then
    raise exception 'Production generation must use the canonical background.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists generation_jobs_automated_source_guard
  on public.generation_jobs;
create trigger generation_jobs_automated_source_guard
before insert or update of source, number_of_variations, background_variant
on public.generation_jobs
for each row execute function public.enforce_automated_generation_source();

create or replace function public.enforce_daily_automation_production_config()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.timezone is distinct from 'Europe/Rome'
     or new.local_hour is distinct from 10
     or new.daily_count is distinct from 10
     or new.quality is distinct from 'medium'
     or new.background_variant is distinct from 'canonical-taupe'
     or new.planner_model is distinct from 'gpt-5.6-luna' then
    raise exception 'The production daily automation configuration is fixed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_artwork_automation_production_guard
  on public.daily_artwork_automation;
create trigger daily_artwork_automation_production_guard
before insert or update of timezone, local_hour, daily_count, quality,
  background_variant, planner_model
on public.daily_artwork_automation
for each row execute function public.enforce_daily_automation_production_config();

revoke all on function public.enforce_automated_generation_source()
from public, anon, authenticated;
grant execute on function public.enforce_automated_generation_source()
to service_role;

revoke all on function public.enforce_daily_automation_production_config()
from public, anon, authenticated;
grant execute on function public.enforce_daily_automation_production_config()
to service_role;

notify pgrst, 'reload schema';

commit;
