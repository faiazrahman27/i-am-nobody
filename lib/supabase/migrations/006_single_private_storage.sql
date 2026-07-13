-- I AM NOBODY Image Studio
-- Migration 006: use one private Supabase Storage bucket only.
--
-- IMPORTANT:
-- Supabase Storage buckets must be deleted through the Dashboard or Storage API.
-- This migration never directly deletes rows from storage.buckets.
--
-- Final bucket:
-- nobody-private
--
-- The obsolete nobody-public bucket must not exist before this migration runs.

begin;

-- Stop clearly if the obsolete public bucket still exists.
-- In your case, you already deleted it manually, so this check should pass.
do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'nobody-public'
  ) then
    raise exception
      'The obsolete nobody-public bucket still exists. Delete it from Supabase Dashboard -> Storage, then run migration 006 again.';
  end if;
end;
$$;

-- Recreate or normalize the one permanent private bucket.
-- You deleted both buckets manually, so this recreates nobody-private.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'nobody-private',
  'nobody-private',
  false,
  52428800,
  array[
    'image/png',
    'image/webp',
    'image/jpeg',
    'application/json',
    'application/pdf'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove every obsolete public-bucket policy.
drop policy if exists nobody_public_read
  on storage.objects;

drop policy if exists nobody_public_admin_insert
  on storage.objects;

drop policy if exists nobody_public_admin_update
  on storage.objects;

drop policy if exists nobody_public_admin_delete
  on storage.objects;

-- Recreate the private-bucket policies so the final state is known
-- even though the bucket itself was deleted and recreated.
drop policy if exists nobody_private_admin_select
  on storage.objects;

drop policy if exists nobody_private_admin_insert
  on storage.objects;

drop policy if exists nobody_private_admin_update
  on storage.objects;

drop policy if exists nobody_private_admin_delete
  on storage.objects;

create policy nobody_private_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_private_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_private_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
)
with check (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

create policy nobody_private_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'nobody-private'
  and public.is_studio_admin()
);

-- Normalize any existing database records.
update public.artwork_variants
set storage_bucket = 'nobody-private'
where storage_bucket is distinct from 'nobody-private';

update public.template_renders
set storage_bucket = 'nobody-private'
where storage_bucket is distinct from 'nobody-private';

-- Prevent future records from pointing to another bucket.
alter table public.artwork_variants
  drop constraint if exists artwork_variants_single_bucket_check;

alter table public.artwork_variants
  add constraint artwork_variants_single_bucket_check
  check (storage_bucket = 'nobody-private');

alter table public.template_renders
  drop constraint if exists template_renders_single_bucket_check;

alter table public.template_renders
  add constraint template_renders_single_bucket_check
  check (storage_bucket = 'nobody-private');

-- Update the canonical-reference architecture without deleting
-- any existing metadata fields.
update public.brand_references
set
  version = '2.0.0',

  metadata =
    coalesce(metadata, '{}'::jsonb)
    ||
    jsonb_build_object(
      'canonical_output',
      '906x1280',

      'model_canvas',
      '896x1264',

      'brand_role',
      'highest_visual_authority',

      'generation_mode',
      'clean_artwork_from_reference',

      'reference_policy',
      'automatically_attached_server_side',

      'typography_policy',
      'separate_controlled_template_layer',

      'storage_policy',
      'single_private_bucket',

      'storage_bucket',
      'nobody-private',

      'crop_policy',
      'no_destructive_crop'
    ),

  updated_at = timezone('utc', now())

where reference_code = 'IAMN-COVER-CANONICAL-001';

commit;
