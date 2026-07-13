-- I AM NOBODY Image Studio
-- Migration 004: database-enforced generation and spending limits.
--
-- This protects the OpenAI account against:
-- - repeated button clicks;
-- - several open browser tabs;
-- - direct repeated API requests;
-- - concurrent generation requests;
-- - excessive daily or monthly generation.
--
-- Failed generation jobs are still counted because an upstream OpenAI
-- request may already have incurred a charge.

begin;

create table if not exists public.image_generation_policy (
  singleton boolean primary key default true
    check (singleton = true),

  is_enabled boolean not null default true,

  max_images_per_job integer not null default 4
    check (max_images_per_job between 1 and 4),

  max_images_per_hour integer not null default 4
    check (max_images_per_hour > 0),

  max_images_per_day integer not null default 8
    check (max_images_per_day > 0),

  max_images_per_month integer not null default 40
    check (max_images_per_month > 0),

  max_high_quality_images_per_day integer not null default 2
    check (max_high_quality_images_per_day >= 0),

  max_concurrent_jobs integer not null default 1
    check (max_concurrent_jobs > 0),

  cooldown_seconds integer not null default 120
    check (cooldown_seconds between 0 and 86400),

  active_job_ttl_minutes integer not null default 20
    check (active_job_ttl_minutes between 5 and 120),

  max_reserved_cost_usd_per_month numeric(12, 2)
    not null default 10.00
    check (max_reserved_cost_usd_per_month > 0),

  created_at timestamptz not null
    default timezone('utc', now()),

  updated_at timestamptz not null
    default timezone('utc', now())
);

insert into public.image_generation_policy (
  singleton,
  is_enabled,
  max_images_per_job,
  max_images_per_hour,
  max_images_per_day,
  max_images_per_month,
  max_high_quality_images_per_day,
  max_concurrent_jobs,
  cooldown_seconds,
  active_job_ttl_minutes,
  max_reserved_cost_usd_per_month
)
values (
  true,
  true,
  4,
  4,
  8,
  40,
  2,
  1,
  120,
  20,
  10.00
)
on conflict (singleton) do update
set
  is_enabled = excluded.is_enabled,
  max_images_per_job = excluded.max_images_per_job,
  max_images_per_hour = excluded.max_images_per_hour,
  max_images_per_day = excluded.max_images_per_day,
  max_images_per_month = excluded.max_images_per_month,
  max_high_quality_images_per_day =
    excluded.max_high_quality_images_per_day,
  max_concurrent_jobs = excluded.max_concurrent_jobs,
  cooldown_seconds = excluded.cooldown_seconds,
  active_job_ttl_minutes = excluded.active_job_ttl_minutes,
  max_reserved_cost_usd_per_month =
    excluded.max_reserved_cost_usd_per_month,
  updated_at = timezone('utc', now());

drop trigger if exists
  image_generation_policy_set_updated_at
on public.image_generation_policy;

create trigger image_generation_policy_set_updated_at
before update on public.image_generation_policy
for each row
execute function public.set_updated_at();

alter table public.image_generation_policy
  enable row level security;

revoke all
on public.image_generation_policy
from anon, authenticated;

grant all
on public.image_generation_policy
to service_role;

create or replace function public.enforce_image_generation_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.image_generation_policy%rowtype;

  active_jobs integer := 0;
  images_last_hour integer := 0;
  images_today integer := 0;
  images_this_month integer := 0;
  high_quality_images_today integer := 0;

  reserved_cost_this_month numeric(12, 6) := 0;
  estimated_request_cost numeric(12, 6) := 0;

  latest_generation_at timestamptz;
  retry_after_seconds integer := 0;

  utc_day_start timestamptz :=
    (
      date_trunc(
        'day',
        now() at time zone 'UTC'
      ) at time zone 'UTC'
    );

  utc_month_start timestamptz :=
    (
      date_trunc(
        'month',
        now() at time zone 'UTC'
      ) at time zone 'UTC'
    );
begin
  -- Only actual generation requests need the cost guard.
  if new.status not in ('queued', 'generating') then
    return new;
  end if;

  -- Serialize all generation checks.
  -- This prevents two Vercel instances from passing the limits
  -- simultaneously.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'iam-nobody-image-generation-guard',
      0
    )
  );

  select *
  into policy_row
  from public.image_generation_policy
  where singleton = true;

  if not found then
    raise exception
      'The image-generation safety policy is missing.'
      using errcode = 'P0001';
  end if;

  if policy_row.is_enabled = false then
    raise exception
      'Image generation is currently disabled by the safety policy.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.studio_admins
    where user_id = new.requested_by
      and is_active = true
      and role in ('owner', 'editor')
  ) then
    raise exception
      'Only an active studio owner or editor may generate images.'
      using errcode = 'P0001';
  end if;

  if new.number_of_variations >
     policy_row.max_images_per_job then
    raise exception
      'A generation job may create at most % image(s).',
      policy_row.max_images_per_job
      using errcode = 'P0001';
  end if;

  /*
   * Conservative internal cost reservation.
   *
   * These values deliberately exceed the typical output-only price
   * because an edit also processes the canonical reference image.
   *
   * They are safety estimates, not OpenAI invoice calculations.
   */
  estimated_request_cost :=
    new.number_of_variations *
    case new.quality
      when 'low' then 0.04
      when 'medium' then 0.10
      when 'high' then 0.30
      else 0.30
    end;

  select max(created_at)
  into latest_generation_at
  from public.generation_jobs
  where status not in ('draft', 'cancelled');

  if latest_generation_at is not null
     and latest_generation_at >
       now() - make_interval(
         secs => policy_row.cooldown_seconds
       ) then

    retry_after_seconds := greatest(
      1,
      ceil(
        extract(
          epoch from (
            latest_generation_at
            + make_interval(
                secs => policy_row.cooldown_seconds
              )
            - now()
          )
        )
      )::integer
    );

    raise exception
      'Please wait % second(s) before starting another generation.',
      retry_after_seconds
      using errcode = 'P0001';
  end if;

  select count(*)::integer
  into active_jobs
  from public.generation_jobs
  where status in ('queued', 'generating')
    and created_at >
      now() - make_interval(
        mins => policy_row.active_job_ttl_minutes
      );

  if active_jobs >= policy_row.max_concurrent_jobs then
    raise exception
      'Another image generation is already running. Wait for it to finish.'
      using errcode = 'P0001';
  end if;

  select
    coalesce(
      sum(number_of_variations),
      0
    )::integer
  into images_last_hour
  from public.generation_jobs
  where status not in ('draft', 'cancelled')
    and created_at >= now() - interval '1 hour';

  if images_last_hour + new.number_of_variations >
     policy_row.max_images_per_hour then
    raise exception
      'The hourly safety limit is % image(s).',
      policy_row.max_images_per_hour
      using errcode = 'P0001';
  end if;

  select
    coalesce(
      sum(number_of_variations),
      0
    )::integer
  into images_today
  from public.generation_jobs
  where status not in ('draft', 'cancelled')
    and created_at >= utc_day_start;

  if images_today + new.number_of_variations >
     policy_row.max_images_per_day then
    raise exception
      'The daily safety limit is % image(s). It resets at 00:00 UTC.',
      policy_row.max_images_per_day
      using errcode = 'P0001';
  end if;

  select
    coalesce(
      sum(number_of_variations),
      0
    )::integer
  into images_this_month
  from public.generation_jobs
  where status not in ('draft', 'cancelled')
    and created_at >= utc_month_start;

  if images_this_month + new.number_of_variations >
     policy_row.max_images_per_month then
    raise exception
      'The monthly safety limit is % image(s).',
      policy_row.max_images_per_month
      using errcode = 'P0001';
  end if;

  if new.quality = 'high' then
    select
      coalesce(
        sum(number_of_variations),
        0
      )::integer
    into high_quality_images_today
    from public.generation_jobs
    where status not in ('draft', 'cancelled')
      and quality = 'high'
      and created_at >= utc_day_start;

    if high_quality_images_today +
       new.number_of_variations >
       policy_row.max_high_quality_images_per_day then
      raise exception
        'The daily high-quality limit is % image(s).',
        policy_row.max_high_quality_images_per_day
        using errcode = 'P0001';
    end if;
  end if;

  select
    coalesce(
      sum(estimated_cost_usd),
      0
    )
  into reserved_cost_this_month
  from public.generation_jobs
  where status not in ('draft', 'cancelled')
    and created_at >= utc_month_start;

  if reserved_cost_this_month +
     estimated_request_cost >
     policy_row.max_reserved_cost_usd_per_month then
    raise exception
      'The application monthly cost guard of USD % has been reached.',
      policy_row.max_reserved_cost_usd_per_month
      using errcode = 'P0001';
  end if;

  new.estimated_cost_usd :=
    greatest(
      coalesce(
        new.estimated_cost_usd,
        0
      ),
      estimated_request_cost
    );

  new.metadata :=
    coalesce(
      new.metadata,
      '{}'::jsonb
    )
    ||
    jsonb_build_object(
      'generation_guard',
      jsonb_build_object(
        'policy_version',
        '1.0.0',

        'estimated_max_cost_usd',
        estimated_request_cost,

        'images_before_this_request',
        jsonb_build_object(
          'hour',
          images_last_hour,

          'day',
          images_today,

          'month',
          images_this_month
        ),

        'limits',
        jsonb_build_object(
          'images_per_job',
          policy_row.max_images_per_job,

          'images_per_hour',
          policy_row.max_images_per_hour,

          'images_per_day',
          policy_row.max_images_per_day,

          'images_per_month',
          policy_row.max_images_per_month,

          'high_quality_images_per_day',
          policy_row.max_high_quality_images_per_day,

          'reserved_cost_usd_per_month',
          policy_row.max_reserved_cost_usd_per_month
        )
      )
    );

  return new;
end;
$$;

revoke all
on function public.enforce_image_generation_limits()
from public, anon, authenticated;

grant execute
on function public.enforce_image_generation_limits()
to service_role;

drop trigger if exists
  generation_jobs_enforce_image_limits
on public.generation_jobs;

create trigger generation_jobs_enforce_image_limits
before insert on public.generation_jobs
for each row
execute function public.enforce_image_generation_limits();

commit;
