-- I AM NOBODY Image Studio
-- Migration 009: deterministic template renders and controlled publication.

begin;

alter table public.template_renders
  add column if not exists sha256 text,
  add column if not exists error_message text,
  add column if not exists rendered_at timestamptz;

alter table public.gallery_entries
  add column if not exists unpublished_at timestamptz;

create index if not exists template_renders_ready_idx
  on public.template_renders (
    artwork_variant_id,
    status,
    template_type,
    created_at desc
  );

create index if not exists gallery_entries_slug_public_idx
  on public.gallery_entries (slug)
  where status = 'published' and visibility = 'public';

create or replace function public.lock_approved_artwork_master()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.immutable_at is not null then
    if new.storage_bucket is distinct from old.storage_bucket
       or new.storage_path is distinct from old.storage_path
       or new.sha256 is distinct from old.sha256
       or new.width is distinct from old.width
       or new.height is distinct from old.height
       or new.mime_type is distinct from old.mime_type then
      raise exception
        'Approved artwork masters are immutable. Create a new variant instead.';
    end if;
  end if;

  if new.status in (
    'approved_artwork',
    'approved_for_template',
    'published'
  ) and new.immutable_at is null then
    new.immutable_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists artwork_variants_lock_master
  on public.artwork_variants;

create trigger artwork_variants_lock_master
before update on public.artwork_variants
for each row
execute function public.lock_approved_artwork_master();

commit;
