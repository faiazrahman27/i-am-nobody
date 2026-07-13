-- I AM NOBODY Image Studio
-- Migration 007: clean artwork generation and permanent reference tracking.

begin;

alter table public.generation_jobs
  add column if not exists generation_mode text not null
    default 'clean_artwork'
    check (generation_mode in ('clean_artwork')),
  add column if not exists output_kind text not null
    default 'clean_master'
    check (output_kind in ('clean_master')),
  add column if not exists reference_sha256 text,
  add column if not exists reference_version text,
  add column if not exists provider_request_id text;

alter table public.artwork_variants
  add column if not exists raw_storage_path text,
  add column if not exists reference_sha256 text,
  add column if not exists reference_version text,
  add column if not exists provider_request_id text,
  add column if not exists technical_validation jsonb not null
    default '{}'::jsonb,
  add column if not exists parent_variant_id uuid
    references public.artwork_variants(id) on delete set null,
  add column if not exists generation_attempt integer not null
    default 1 check (generation_attempt > 0),
  add column if not exists immutable_at timestamptz;

update public.artwork_variants
set raw_storage_path = nullif(metadata ->> 'raw_model_storage_path', '')
where raw_storage_path is null;

alter table public.artwork_variants
  drop constraint if exists artwork_variants_status_check;

alter table public.artwork_variants
  add constraint artwork_variants_status_check
  check (
    status in (
      'candidate',
      'reviewing',
      'auto_rejected',
      'auto_review_failed',
      'ready_for_review',
      'approved_artwork',
      'needs_regeneration',
      'wrong_mask',
      'wrong_composition',
      'too_busy',
      'too_literal',
      'too_generic',
      'approved_for_template',
      'published',
      'archived'
    )
  );

create index if not exists artwork_variants_parent_idx
  on public.artwork_variants (parent_variant_id, generation_attempt);

create index if not exists generation_jobs_reference_idx
  on public.generation_jobs (reference_sha256, created_at desc);

update public.archetypes
set
  prompt_version = '2.0.0',
  updated_at = timezone('utc', now())
where active = true;

commit;
