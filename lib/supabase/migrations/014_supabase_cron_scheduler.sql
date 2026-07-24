-- I AM NOBODY Image Studio
-- Migration 014: move repeated daily-worker scheduling from Vercel Cron
-- to Supabase Cron + pg_net while keeping Vercel as the application host.
--
-- Run after migration 013.
-- Store these two values in Supabase Vault before configuration:
--   iamnobody_worker_url   = https://www.iamnobody.live/api/automation/daily-artworks
--   iamnobody_cron_secret  = the exact same CRON_SECRET used in Vercel
-- Then run:
--   select nobody_private.configure_nobody_supabase_cron();

begin;

create extension if not exists supabase_vault cascade;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists nobody_private;
revoke all on schema nobody_private from public, anon, authenticated;

create or replace function nobody_private.configure_nobody_supabase_cron()
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
    raise exception 'Vault secret iamnobody_worker_url is missing or invalid. It must be the production HTTPS worker URL.';
  end if;

  if length(v_cron_secret) < 32 then
    raise exception 'Vault secret iamnobody_cron_secret is missing or invalid. It must match the Vercel CRON_SECRET and contain at least 32 characters.';
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
  )
  into v_job_id;

  update public.daily_artwork_automation
  set
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'scheduler', 'supabase-cron',
      'scheduler_job_name', 'iamnobody-daily-artwork-worker',
      'worker_frequency', 'every 10 minutes',
      'worker_url', v_worker_url,
      'vercel_cron_enabled', false,
      'schedule', '08:00 Europe/Rome with automatic catch-up waves',
      'late_generation_policy', 'after 08:00 Europe/Rome, every remaining queued or retryable artwork is processed on the next Supabase Cron worker wave'
    ),
    updated_at = timezone('utc', now())
  where singleton = true;

  return jsonb_build_object(
    'configured', true,
    'scheduler', 'supabase-cron',
    'job_id', v_job_id,
    'job_name', 'iamnobody-daily-artwork-worker',
    'schedule', '*/10 * * * *',
    'worker_url', v_worker_url
  );
end;
$$;

create or replace function nobody_private.trigger_nobody_supabase_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, vault, net
as $$
declare
  v_worker_url text;
  v_cron_secret text;
  v_request_id bigint;
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
    raise exception 'Supabase Cron is not configured: iamnobody_worker_url is missing or invalid.';
  end if;

  if length(v_cron_secret) < 32 then
    raise exception 'Supabase Cron is not configured: iamnobody_cron_secret is missing or invalid.';
  end if;

  select net.http_get(
    url := v_worker_url,
    params := jsonb_build_object('limit', '10'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || v_cron_secret,
      'Accept',
      'application/json',
      'User-Agent',
      'I-AM-NOBODY-Supabase-Cron-Manual-Test/1.0'
    ),
    timeout_milliseconds := 295000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function nobody_private.configure_nobody_supabase_cron()
from public, anon, authenticated;
revoke all on function nobody_private.trigger_nobody_supabase_worker()
from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
