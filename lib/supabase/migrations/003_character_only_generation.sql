-- I AM NOBODY Image Studio
-- Character-only generation correction.
--
-- Final output:
-- 906x1280 canonical cover.
--
-- Internal OpenAI model canvas:
-- 896x1264.
--
-- The server restores:
-- 1. Every original non-character pixel.
-- 2. The original title.
-- 3. The original subtitle.
-- 4. The original author name.
-- 5. The original decorative colour lines.
--
-- No destructive crop is permitted.

begin;

alter table public.generation_jobs
  alter column output_width
    set default 906,
  alter column output_height
    set default 1280,
  alter column max_retries
    set default 1;

update public.brand_references
set
  version = '1.1.0',
  metadata = jsonb_build_object(
    'canonical_output',
    '906x1280',

    'model_canvas',
    '896x1264',

    'brand_role',
    'highest_visual_authority',

    'edit_scope',
    'character_only',

    'text_policy',
    'restore_original_controlled_text_after_generation',

    'crop_policy',
    'no_destructive_crop'
  ),
  updated_at = timezone(
    'utc',
    now()
  )
where reference_code =
  'IAMN-COVER-CANONICAL-001';

update public.archetypes
set
  prompt_version = '1.1.0',
  updated_at = timezone(
    'utc',
    now()
  )
where active = true;

commit;