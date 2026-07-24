-- I AM NOBODY Image Studio
-- Migration 015: pause all scheduled generation and switch the Studio
-- to manual one-artwork-at-a-time testing mode.
--
-- This migration is intentionally safe to run while queued artwork items exist.
-- It does not delete batches, plans, artworks, reviews, storage objects, or history.
-- Any request already in flight when this migration is run may still finish.

begin;

create extension if not exists supabase_vault cascade;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists nobody_private;
revoke all on schema nobody_private from public, anon, authenticated;

create or replace function public.pause_nobody_daily_automation()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, cron
as $$
declare
  v_existing record;
  v_removed integer := 0;
begin
  for v_existing in
    select jobid
    from cron.job
    where jobname = 'iamnobody-daily-artwork-worker'
  loop
    perform cron.unschedule(v_existing.jobid);
    v_removed := v_removed + 1;
  end loop;

  update public.daily_artwork_automation
  set
    is_enabled = false,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduler', 'supabase-cron',
      'scheduler_state', 'paused',
      'scheduler_job_active', false,
      'manual_testing_mode', true,
      'manual_generation_enabled', true,
      'manual_generation_batch_size', 1,
      'automatic_generation_enabled', false,
      'pause_reason', 'manual artwork quality testing',
      'schedule', 'Paused — manual testing only'
    ),
    updated_at = timezone('utc', now())
  where singleton = true;

  return jsonb_build_object(
    'paused', true,
    'automatic_generation_enabled', false,
    'manual_testing_mode', true,
    'removed_cron_jobs', v_removed
  );
end;
$$;

create or replace function public.resume_nobody_daily_automation()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, vault, cron, net
as $$
declare
  v_worker_url text;
  v_cron_secret text;
  v_job_id bigint;
  v_existing record;
begin
  select decrypted_secret
  into v_worker_url
  from vault.decrypted_secrets
  where name = 'iamnobody_worker_url'
  limit 1;

  select decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets
  where name = 'iamnobody_cron_secret'
  limit 1;

  v_worker_url := regexp_replace(btrim(coalesce(v_worker_url, '')), '/+$', '');
  v_cron_secret := btrim(coalesce(v_cron_secret, ''));

  if v_worker_url !~ '^https://[A-Za-z0-9.-]+(?::[0-9]+)?/api/automation/daily-artworks$' then
    raise exception 'Vault secret iamnobody_worker_url is missing or invalid.';
  end if;

  if length(v_cron_secret) < 32 then
    raise exception 'Vault secret iamnobody_cron_secret is missing or invalid.';
  end if;

  for v_existing in
    select jobid
    from cron.job
    where jobname = 'iamnobody-daily-artwork-worker'
  loop
    perform cron.unschedule(v_existing.jobid);
  end loop;

  select cron.schedule(
    'iamnobody-daily-artwork-worker',
    '*/10 * * * *',
    $worker$
      select net.http_get(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'iamnobody_worker_url'
          limit 1
        ),
        params := jsonb_build_object('limit', '10'),
        headers := jsonb_build_object(
          'Authorization',
          'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'iamnobody_cron_secret'
            limit 1
          ),
          'Accept',
          'application/json',
          'User-Agent',
          'I-AM-NOBODY-Supabase-Cron/1.0'
        ),
        timeout_milliseconds := 295000
      ) as request_id;
    $worker$
  ) into v_job_id;

  update public.daily_artwork_automation
  set
    is_enabled = true,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduler', 'supabase-cron',
      'scheduler_state', 'active',
      'scheduler_job_active', true,
      'manual_testing_mode', false,
      'manual_generation_enabled', true,
      'manual_generation_batch_size', 1,
      'automatic_generation_enabled', true,
      'pause_reason', null,
      'schedule', '08:00 Europe/Rome with automatic catch-up waves',
      'worker_frequency', 'every 10 minutes'
    ),
    updated_at = timezone('utc', now())
  where singleton = true;

  return jsonb_build_object(
    'resumed', true,
    'automatic_generation_enabled', true,
    'manual_testing_mode', false,
    'job_id', v_job_id,
    'schedule', '*/10 * * * *'
  );
end;
$$;

revoke all on function public.pause_nobody_daily_automation()
from public, anon, authenticated;
revoke all on function public.resume_nobody_daily_automation()
from public, anon, authenticated;

grant execute on function public.pause_nobody_daily_automation()
to service_role;
grant execute on function public.resume_nobody_daily_automation()
to service_role;

-- Keep the user's stated monthly application guard at USD 30.
-- Manual mode generates only one queued artwork per button click.
update public.image_generation_policy
set
  is_enabled = true,
  max_images_per_job = 1,
  max_images_per_hour = greatest(max_images_per_hour, 12),
  max_images_per_day = greatest(max_images_per_day, 80),
  max_images_per_month = least(greatest(max_images_per_month, 100), 100),
  max_high_quality_images_per_day = greatest(max_high_quality_images_per_day, 60),
  max_concurrent_jobs = 1,
  cooldown_seconds = 0,
  max_reserved_cost_usd_per_month = 30.00,
  updated_at = timezone('utc', now())
where singleton = true;

select public.pause_nobody_daily_automation();

notify pgrst, 'reload schema';

commit;
