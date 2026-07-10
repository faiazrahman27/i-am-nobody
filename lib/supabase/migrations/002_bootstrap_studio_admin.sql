-- Run this only AFTER creating the user in:
-- Supabase Dashboard -> Authentication -> Users -> Add user.
-- Replace the email and display name below before running it.

begin;

do $$
declare
  target_email text := 'mdazmayeenfaiaz@gmail.com';
  target_display_name text := 'FAIAZ';
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception
      'No Supabase Auth user exists for email %',
      target_email;
  end if;

  insert into public.studio_admins (
    user_id,
    email,
    display_name,
    role,
    is_active
  )
  values (
    target_user_id,
    target_email,
    target_display_name,
    'owner',
    true
  )
  on conflict (user_id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    role = excluded.role,
    is_active = true,
    updated_at = timezone('utc', now());
end;
$$;

commit;