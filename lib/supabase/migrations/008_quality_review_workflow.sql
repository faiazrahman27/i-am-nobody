-- I AM NOBODY Image Studio
-- Migration 008: automated visual review followed by human approval.

begin;

alter table public.image_generation_policy
  add column if not exists automated_review_enabled boolean not null
    default true,
  add column if not exists automated_review_threshold numeric(5, 2) not null
    default 75.00
    check (automated_review_threshold between 0 and 100);

alter table public.artwork_variants
  add column if not exists visual_score numeric(5, 2)
    check (visual_score is null or visual_score between 0 and 100),
  add column if not exists automated_review_status text not null
    default 'pending'
    check (
      automated_review_status in (
        'pending',
        'running',
        'passed',
        'failed',
        'error',
        'skipped'
      )
    ),
  add column if not exists automated_reviewed_at timestamptz,
  add column if not exists automated_review_model text;

alter table public.quality_reviews
  add column if not exists provider_request_id text,
  add column if not exists provider_response_id text,
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists summary text,
  add column if not exists usage jsonb not null default '{}'::jsonb;

alter table public.quality_reviews
  drop constraint if exists quality_reviews_checklist_array_check;

alter table public.quality_reviews
  add constraint quality_reviews_checklist_array_check
  check (jsonb_typeof(checklist) = 'array');

create index if not exists artwork_variants_review_score_idx
  on public.artwork_variants (
    automated_review_status,
    visual_score desc,
    created_at desc
  );

commit;
