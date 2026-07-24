-- I AM NOBODY Image Studio
-- Migration 013: move production automation to 08:00 Rome,
-- use high-quality daily generation, and keep enough capacity for
-- five parallel workers plus automatic retries.
-- Run after migration 012.

begin;

-- Migration 012 installed a guard for the previous 10:00 / medium setup.
drop trigger if exists daily_artwork_automation_production_guard
  on public.daily_artwork_automation;

update public.image_generation_policy
set
  is_enabled = true,
  automated_review_enabled = true,
  max_images_per_job = 1,
  max_images_per_hour = greatest(max_images_per_hour, 20),
  max_images_per_day = greatest(max_images_per_day, 40),
  max_images_per_month = greatest(max_images_per_month, 900),
  max_high_quality_images_per_day = greatest(max_high_quality_images_per_day, 25),
  max_concurrent_jobs = greatest(max_concurrent_jobs, 5),
  cooldown_seconds = 0,
  active_job_ttl_minutes = greatest(active_job_ttl_minutes, 20),
  max_reserved_cost_usd_per_month = greatest(max_reserved_cost_usd_per_month, 250.00),
  updated_at = timezone('utc', now())
where singleton = true;

update public.daily_artwork_automation
set
  is_enabled = true,
  timezone = 'Europe/Rome',
  local_hour = 8,
  daily_count = 10,
  quality = 'high',
  background_variant = 'canonical-taupe',
  planner_model = 'gpt-5.6-luna',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'production_mode', true,
    'manual_generation_enabled', true,
    'human_approval_required', true,
    'daily_count', 10,
    'schedule', '08:00 Europe/Rome',
    'worker_frequency', 'every 10 minutes during the Rome daytime and evening recovery window',
    'late_generation_policy', 'after 08:00, process every remaining queued artwork on the next worker wave until the daily set is complete',
    'fixed_background', 'IAMN-BACKGROUND-CANONICAL-001',
    'fixed_template', true,
    'quality', 'high'
  ),
  updated_at = timezone('utc', now())
where singleton = true;

create or replace function public.enforce_daily_automation_production_config()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.timezone is distinct from 'Europe/Rome'
     or new.local_hour is distinct from 8
     or new.daily_count is distinct from 10
     or new.quality is distinct from 'high'
     or new.background_variant is distinct from 'canonical-taupe'
     or new.planner_model is distinct from 'gpt-5.6-luna' then
    raise exception 'The production daily automation configuration is fixed.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger daily_artwork_automation_production_guard
before insert or update of timezone, local_hour, daily_count, quality,
  background_variant, planner_model
on public.daily_artwork_automation
for each row execute function public.enforce_daily_automation_production_config();

revoke all on function public.enforce_daily_automation_production_config()
from public, anon, authenticated;

grant execute on function public.enforce_daily_automation_production_config()
to service_role;

notify pgrst, 'reload schema';

commit;
