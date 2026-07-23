-- I AM NOBODY Image Studio
-- Migration 011: AI-planned daily collections, automated production,
-- human approval, certification, and public verification.
--
-- Creative planning is open-ended. The daily system is not limited to the
-- manually curated archetype table: AI creates ten new role/life-context
-- briefs from the book's themes and recent Studio history each day.

begin;

update public.image_generation_policy
set
  is_enabled = true,
  automated_review_enabled = true,
  max_images_per_hour = greatest(max_images_per_hour, 20),
  max_images_per_day = greatest(max_images_per_day, 30),
  max_images_per_month = greatest(max_images_per_month, 450),
  max_high_quality_images_per_day = greatest(max_high_quality_images_per_day, 4),
  max_concurrent_jobs = greatest(max_concurrent_jobs, 5),
  cooldown_seconds = 0,
  max_reserved_cost_usd_per_month = greatest(max_reserved_cost_usd_per_month, 50.00),
  updated_at = timezone('utc', now())
where singleton = true;

create table if not exists public.daily_artwork_automation (
  singleton boolean primary key default true check (singleton = true),
  is_enabled boolean not null default true,
  timezone text not null default 'Europe/Rome',
  local_hour smallint not null default 10 check (local_hour between 0 and 23),
  daily_count smallint not null default 10 check (daily_count between 1 and 10),
  quality text not null default 'low' check (quality in ('low', 'medium', 'high')),
  background_variant text not null default 'canonical-taupe'
    check (background_variant = 'canonical-taupe'),
  actor_user_id uuid references auth.users(id) on delete restrict,
  planner_model text not null default 'gpt-5.6-luna',
  planner_prompt_version text not null default '2.0.0',
  planner_history_limit smallint not null default 180
    check (planner_history_limit between 10 and 300),
  last_batch_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.daily_artwork_automation
  add column if not exists planner_model text not null default 'gpt-5.6-luna',
  add column if not exists planner_prompt_version text not null default '2.0.0',
  add column if not exists planner_history_limit smallint not null default 180;

update public.daily_artwork_automation
set background_variant = 'canonical-taupe'
where background_variant is distinct from 'canonical-taupe';

alter table public.daily_artwork_automation
  drop constraint if exists daily_artwork_automation_background_variant_check;

alter table public.daily_artwork_automation
  add constraint daily_artwork_automation_background_variant_check
  check (background_variant = 'canonical-taupe');

insert into public.daily_artwork_automation (
  singleton,
  is_enabled,
  timezone,
  local_hour,
  daily_count,
  quality,
  background_variant,
  actor_user_id,
  planner_model,
  planner_prompt_version,
  planner_history_limit,
  metadata
)
select
  true,
  true,
  'Europe/Rome',
  10,
  10,
  'low',
  'canonical-taupe',
  (
    select user_id
    from public.studio_admins
    where is_active = true
      and role in ('owner', 'editor')
    order by case role when 'owner' then 0 else 1 end, created_at
    limit 1
  ),
  'gpt-5.6-luna',
  '2.0.0',
  180,
  jsonb_build_object(
    'schedule', '10:00 Europe/Rome',
    'daily_count', 10,
    'planning', 'ai-generated-open-ended-creative-briefs',
    'human_approval_required', true,
    'fixed_background', 'IAMN-BACKGROUND-CANONICAL-001',
    'fixed_template', true
  )
where not exists (
  select 1
  from public.daily_artwork_automation
  where singleton = true
);

create table if not exists public.daily_artwork_batches (
  id uuid primary key default gen_random_uuid(),
  local_date date not null unique,
  timezone text not null default 'Europe/Rome',
  scheduled_for timestamptz,
  requested_count smallint not null default 10 check (requested_count between 1 and 10),
  completed_count smallint not null default 0 check (completed_count >= 0),
  failed_count smallint not null default 0 check (failed_count >= 0),
  status text not null default 'planning',
  collection_title text,
  collection_note text,
  planner_model text,
  planner_prompt_version text,
  planner_response_id text,
  planner_request_id text,
  planner_attempt_count smallint not null default 0 check (planner_attempt_count between 0 and 5),
  planner_started_at timestamptz,
  planner_completed_at timestamptz,
  planner_error text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.daily_artwork_batches
  add column if not exists collection_title text,
  add column if not exists collection_note text,
  add column if not exists planner_model text,
  add column if not exists planner_prompt_version text,
  add column if not exists planner_response_id text,
  add column if not exists planner_request_id text,
  add column if not exists planner_attempt_count smallint not null default 0,
  add column if not exists planner_started_at timestamptz,
  add column if not exists planner_completed_at timestamptz,
  add column if not exists planner_error text;

alter table public.daily_artwork_batches
  drop constraint if exists daily_artwork_batches_status_check;

alter table public.daily_artwork_batches
  add constraint daily_artwork_batches_status_check
  check (
    status in (
      'planning',
      'planning_failed',
      'queued',
      'running',
      'completed',
      'partially_failed',
      'failed',
      'cancelled'
    )
  );

create table if not exists public.ai_artwork_concepts (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  role_title text not null,
  role_family text not null,
  life_context text not null,
  threshold_name text not null
    check (threshold_name in ('Nobody', 'Somebody', 'Anybody', 'Infinite')),
  book_theme text not null,
  concept_question text not null,
  visual_story text not null,
  clothing_direction text not null,
  mood_direction text not null,
  body_direction text not null,
  object_direction text not null default 'none',
  creative_direction text not null,
  planner_model text not null,
  planner_version text not null,
  first_used_on date not null,
  last_used_on date not null,
  use_count integer not null default 1 check (use_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_artwork_concepts_recent_idx
  on public.ai_artwork_concepts (last_used_on desc, updated_at desc);

create index if not exists ai_artwork_concepts_role_idx
  on public.ai_artwork_concepts (lower(role_title), last_used_on desc);

create table if not exists public.daily_artwork_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null
    references public.daily_artwork_batches(id) on delete cascade,
  concept_id uuid
    references public.ai_artwork_concepts(id) on delete set null,
  position smallint not null check (position between 1 and 10),
  base_archetype_slug text not null default 'nobody-classic'
    references public.archetypes(slug),
  role_title text not null,
  role_family text not null,
  life_context text not null,
  threshold_name text not null
    check (threshold_name in ('Nobody', 'Somebody', 'Anybody', 'Infinite')),
  book_theme text not null,
  concept_question text not null,
  visual_story text not null,
  clothing_direction text not null,
  mood_direction text not null,
  body_direction text not null,
  object_direction text not null default 'none',
  creative_direction text not null,
  quality text not null default 'low' check (quality in ('low', 'medium', 'high')),
  background_variant text not null default 'canonical-taupe'
    check (background_variant = 'canonical-taupe'),
  prop text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  locked_at timestamptz,
  lease_expires_at timestamptz,
  generation_job_id uuid,
  artwork_variant_id uuid,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, position)
);

alter table public.daily_artwork_items
  add column if not exists concept_id uuid references public.ai_artwork_concepts(id) on delete set null,
  add column if not exists base_archetype_slug text references public.archetypes(slug),
  add column if not exists role_title text,
  add column if not exists role_family text,
  add column if not exists life_context text,
  add column if not exists book_theme text,
  add column if not exists visual_story text,
  add column if not exists clothing_direction text,
  add column if not exists mood_direction text,
  add column if not exists body_direction text,
  add column if not exists object_direction text default 'none';

update public.daily_artwork_items
set background_variant = 'canonical-taupe'
where background_variant is distinct from 'canonical-taupe';

alter table public.daily_artwork_items
  drop constraint if exists daily_artwork_items_background_variant_check;

alter table public.daily_artwork_items
  add constraint daily_artwork_items_background_variant_check
  check (background_variant = 'canonical-taupe');

-- Compatibility if an earlier draft of migration 011 created archetype_slug.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_artwork_items'
      and column_name = 'archetype_slug'
  ) then
    execute $sql$
      update public.daily_artwork_items
      set base_archetype_slug = coalesce(base_archetype_slug, archetype_slug, 'nobody-classic')
      where base_archetype_slug is null
    $sql$;

    execute $sql$
      alter table public.daily_artwork_items
      alter column archetype_slug set default 'nobody-classic'
    $sql$;

    execute $sql$
      alter table public.daily_artwork_items
      alter column archetype_slug drop not null
    $sql$;
  end if;
end;
$$;

update public.daily_artwork_items
set base_archetype_slug = 'nobody-classic'
where base_archetype_slug is null;

alter table public.daily_artwork_items
  alter column base_archetype_slug set default 'nobody-classic';

alter table public.generation_jobs
  add column if not exists source text not null default 'manual',
  add column if not exists automation_item_id uuid
    references public.daily_artwork_items(id) on delete set null;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_source_check;

alter table public.generation_jobs
  add constraint generation_jobs_source_check
  check (source in ('manual', 'daily_automation', 'regeneration'));

create unique index if not exists generation_jobs_automation_item_unique
  on public.generation_jobs (automation_item_id)
  where automation_item_id is not null;

alter table public.daily_artwork_items
  drop constraint if exists daily_artwork_items_generation_job_fk;

alter table public.daily_artwork_items
  add constraint daily_artwork_items_generation_job_fk
  foreign key (generation_job_id)
  references public.generation_jobs(id)
  on delete set null;

alter table public.daily_artwork_items
  drop constraint if exists daily_artwork_items_artwork_variant_fk;

alter table public.daily_artwork_items
  add constraint daily_artwork_items_artwork_variant_fk
  foreign key (artwork_variant_id)
  references public.artwork_variants(id)
  on delete set null;

create index if not exists daily_artwork_batches_status_date_idx
  on public.daily_artwork_batches (status, local_date desc);

create index if not exists daily_artwork_items_queue_idx
  on public.daily_artwork_items (status, lease_expires_at, created_at, position);

create table if not exists public.artwork_certificates (
  id uuid primary key default gen_random_uuid(),
  artwork_variant_id uuid not null unique
    references public.artwork_variants(id) on delete restrict,
  generation_job_id uuid not null
    references public.generation_jobs(id) on delete restrict,
  archetype_slug text not null
    references public.archetypes(slug),
  certificate_code text not null unique,
  status text not null default 'valid' check (status in ('valid', 'revoked')),
  artwork_sha256 text not null,
  reference_sha256 text not null,
  verification_hash text not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    status = 'valid'
    or (revoked_at is not null and revoked_reason is not null)
  )
);

create index if not exists artwork_certificates_code_status_idx
  on public.artwork_certificates (certificate_code, status);

create or replace function public.approve_artwork_and_issue_certificate(
  p_artwork_variant_id uuid,
  p_actor_user_id uuid,
  p_human_notes text,
  p_certificate_code text
)
returns table (
  certificate_id uuid,
  certificate_code text,
  issued_at timestamptz,
  verification_hash text,
  artwork_status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  artwork_row public.artwork_variants%rowtype;
  job_row public.generation_jobs%rowtype;
  certificate_row public.artwork_certificates%rowtype;
  approved_timestamp timestamptz := timezone('utc', now());
begin
  if not exists (
    select 1
    from public.studio_admins
    where user_id = p_actor_user_id
      and is_active = true
  ) then
    raise exception 'The approving studio account is not active.';
  end if;

  select * into artwork_row
  from public.artwork_variants
  where id = p_artwork_variant_id
  for update;

  if not found then
    raise exception 'The artwork could not be found.';
  end if;

  if artwork_row.status not in (
    'candidate', 'reviewing', 'auto_rejected', 'auto_review_failed',
    'ready_for_review', 'needs_regeneration', 'wrong_mask',
    'wrong_composition', 'too_busy', 'too_literal', 'too_generic',
    'approved_artwork', 'approved_for_template', 'published'
  ) then
    raise exception 'This artwork cannot be approved from its current state.';
  end if;

  if artwork_row.sha256 is null or artwork_row.reference_sha256 is null then
    raise exception 'The artwork integrity record is incomplete.';
  end if;

  select * into job_row
  from public.generation_jobs
  where id = artwork_row.job_id;

  update public.artwork_variants
  set
    status = case
      when status in ('approved_for_template', 'published') then status
      else 'approved_artwork'
    end,
    human_notes = nullif(trim(coalesce(p_human_notes, '')), ''),
    rejection_reason = null,
    approved_by = coalesce(approved_by, p_actor_user_id),
    approved_at = coalesce(approved_at, approved_timestamp),
    immutable_at = coalesce(immutable_at, approved_timestamp),
    updated_at = approved_timestamp
  where id = artwork_row.id
  returning * into artwork_row;

  select * into certificate_row
  from public.artwork_certificates
  where artwork_variant_id = artwork_row.id;

  if not found then
    insert into public.artwork_certificates (
      artwork_variant_id,
      generation_job_id,
      archetype_slug,
      certificate_code,
      artwork_sha256,
      reference_sha256,
      verification_hash,
      issued_by,
      issued_at,
      metadata
    )
    values (
      artwork_row.id,
      job_row.id,
      job_row.archetype_slug,
      upper(trim(p_certificate_code)),
      artwork_row.sha256,
      artwork_row.reference_sha256,
      encode(
        digest(
          upper(trim(p_certificate_code))
          || ':' || artwork_row.sha256
          || ':' || artwork_row.reference_sha256
          || ':' || to_char(
            approved_timestamp at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ),
          'sha256'
        ),
        'hex'
      ),
      p_actor_user_id,
      approved_timestamp,
      jsonb_build_object(
        'brand_version', job_row.brand_version,
        'prompt_version', job_row.prompt_version,
        'image_model', artwork_row.image_model,
        'artwork_code', artwork_row.artwork_code,
        'generation_source', job_row.source,
        'role_title', job_row.metadata ->> 'role_title',
        'role_family', job_row.metadata ->> 'role_family',
        'threshold', job_row.metadata ->> 'threshold_name',
        'concept_question', job_row.metadata ->> 'concept_question'
      )
    )
    returning * into certificate_row;
  end if;

  return query
  select
    certificate_row.id,
    certificate_row.certificate_code,
    certificate_row.issued_at,
    certificate_row.verification_hash,
    artwork_row.status;
end;
$$;

revoke all
on function public.approve_artwork_and_issue_certificate(uuid, uuid, text, text)
from public, anon, authenticated;

grant execute
on function public.approve_artwork_and_issue_certificate(uuid, uuid, text, text)
to service_role;

create or replace function public.claim_next_daily_artwork_item()
returns table (
  item_id uuid,
  batch_id uuid,
  role_title text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.daily_artwork_items%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('iam-nobody-daily-artwork-worker', 0)
  );

  update public.daily_artwork_items
  set
    status = case when attempt_count >= 3 then 'failed' else 'queued' end,
    locked_at = null,
    lease_expires_at = null,
    error_message = case
      when attempt_count >= 3 then coalesce(
        error_message,
        'The artwork could not be completed after three attempts.'
      )
      else error_message
    end,
    updated_at = timezone('utc', now())
  where status = 'processing'
    and lease_expires_at < timezone('utc', now());

  select item.* into claimed
  from public.daily_artwork_items item
  join public.daily_artwork_batches batch on batch.id = item.batch_id
  where item.status = 'queued'
    and item.attempt_count < 3
    and batch.status in ('queued', 'running', 'partially_failed')
  order by batch.local_date, item.position
  for update of item skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.daily_artwork_items
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    locked_at = timezone('utc', now()),
    lease_expires_at = timezone('utc', now()) + interval '18 minutes',
    error_message = null,
    updated_at = timezone('utc', now())
  where id = claimed.id
  returning * into claimed;

  update public.daily_artwork_batches
  set
    status = 'running',
    started_at = coalesce(started_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where id = claimed.batch_id;

  return query
  select claimed.id, claimed.batch_id, claimed.role_title;
end;
$$;

revoke all on function public.claim_next_daily_artwork_item()
from public, anon, authenticated;

grant execute on function public.claim_next_daily_artwork_item()
to service_role;

create or replace function public.refresh_daily_artwork_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested integer;
  completed integer;
  failed integer;
  pending integer;
begin
  select requested_count into requested
  from public.daily_artwork_batches
  where id = p_batch_id
  for update;

  if not found then return; end if;

  select
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status in ('queued', 'processing'))
  into completed, failed, pending
  from public.daily_artwork_items
  where batch_id = p_batch_id;

  update public.daily_artwork_batches
  set
    completed_count = completed,
    failed_count = failed,
    status = case
      when pending > 0 then 'running'
      when completed = requested then 'completed'
      when completed > 0 and failed > 0 then 'partially_failed'
      when failed >= requested then 'failed'
      else status
    end,
    completed_at = case
      when pending = 0 then timezone('utc', now())
      else null
    end,
    updated_at = timezone('utc', now())
  where id = p_batch_id;
end;
$$;

revoke all on function public.refresh_daily_artwork_batch(uuid)
from public, anon, authenticated;

grant execute on function public.refresh_daily_artwork_batch(uuid)
to service_role;

create or replace function public.lock_artwork_certificate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.artwork_variant_id is distinct from old.artwork_variant_id
     or new.generation_job_id is distinct from old.generation_job_id
     or new.archetype_slug is distinct from old.archetype_slug
     or new.certificate_code is distinct from old.certificate_code
     or new.artwork_sha256 is distinct from old.artwork_sha256
     or new.reference_sha256 is distinct from old.reference_sha256
     or new.verification_hash is distinct from old.verification_hash
     or new.issued_by is distinct from old.issued_by
     or new.issued_at is distinct from old.issued_at then
    raise exception 'Issued certificate identity and integrity fields are immutable.';
  end if;

  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists artwork_certificates_lock on public.artwork_certificates;
create trigger artwork_certificates_lock
before update on public.artwork_certificates
for each row execute function public.lock_artwork_certificate();

drop trigger if exists daily_artwork_automation_set_updated_at
  on public.daily_artwork_automation;
create trigger daily_artwork_automation_set_updated_at
before update on public.daily_artwork_automation
for each row execute function public.set_updated_at();

drop trigger if exists daily_artwork_batches_set_updated_at
  on public.daily_artwork_batches;
create trigger daily_artwork_batches_set_updated_at
before update on public.daily_artwork_batches
for each row execute function public.set_updated_at();

drop trigger if exists ai_artwork_concepts_set_updated_at
  on public.ai_artwork_concepts;
create trigger ai_artwork_concepts_set_updated_at
before update on public.ai_artwork_concepts
for each row execute function public.set_updated_at();

drop trigger if exists daily_artwork_items_set_updated_at
  on public.daily_artwork_items;
create trigger daily_artwork_items_set_updated_at
before update on public.daily_artwork_items
for each row execute function public.set_updated_at();

alter table public.daily_artwork_automation enable row level security;
alter table public.daily_artwork_batches enable row level security;
alter table public.ai_artwork_concepts enable row level security;
alter table public.daily_artwork_items enable row level security;
alter table public.artwork_certificates enable row level security;

drop policy if exists daily_artwork_automation_admin_all
  on public.daily_artwork_automation;
create policy daily_artwork_automation_admin_all
on public.daily_artwork_automation
for all to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

drop policy if exists daily_artwork_batches_admin_all
  on public.daily_artwork_batches;
create policy daily_artwork_batches_admin_all
on public.daily_artwork_batches
for all to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

drop policy if exists ai_artwork_concepts_admin_all
  on public.ai_artwork_concepts;
create policy ai_artwork_concepts_admin_all
on public.ai_artwork_concepts
for all to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

drop policy if exists daily_artwork_items_admin_all
  on public.daily_artwork_items;
create policy daily_artwork_items_admin_all
on public.daily_artwork_items
for all to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

drop policy if exists artwork_certificates_admin_all
  on public.artwork_certificates;
create policy artwork_certificates_admin_all
on public.artwork_certificates
for all to authenticated
using (public.is_studio_admin())
with check (public.is_studio_admin());

revoke all on public.daily_artwork_automation from anon;
revoke all on public.daily_artwork_batches from anon;
revoke all on public.ai_artwork_concepts from anon;
revoke all on public.daily_artwork_items from anon;
revoke all on public.artwork_certificates from anon;

grant select, insert, update, delete
on public.daily_artwork_automation,
   public.daily_artwork_batches,
   public.ai_artwork_concepts,
   public.daily_artwork_items,
   public.artwork_certificates
to authenticated;

grant all
on public.daily_artwork_automation,
   public.daily_artwork_batches,
   public.ai_artwork_concepts,
   public.daily_artwork_items,
   public.artwork_certificates
to service_role;

commit;
