-- I AM NOBODY Image Studio
-- Migration 010: approved clean masters remain permanently immutable.
--
-- An artwork may be moved back to a review status, but once it has been
-- approved its stored master file, dimensions, MIME type, hash, and
-- immutable timestamp can never be changed or cleared.

begin;

create or replace function public.lock_approved_artwork_master()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.immutable_at is not null then
    if new.immutable_at is null
       or new.immutable_at is distinct from old.immutable_at then
      raise exception
        'The approved artwork immutable timestamp cannot be changed or cleared.';
    end if;

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