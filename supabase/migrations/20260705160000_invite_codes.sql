-- Invite-code registration and per-user data isolation.

-- Cleanup tables from a previously reverted auth migration (safe no-op if absent).
drop table if exists public.user_oauth_identities cascade;
drop table if exists public.usage_events cascade;
drop table if exists public.subscription_events cascade;

-- ---------------------------------------------------------------------------
-- invite_codes
-- ---------------------------------------------------------------------------
create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid (),
  code text not null unique,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table public.invite_codes enable row level security;

-- Only service_role may read/write invite codes (via API routes).

create or replace function public.consume_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes%rowtype;
begin
  select * into v_row
  from public.invite_codes
  where lower(code) = lower(trim(p_code))
  for update;

  if not found then
    return false;
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return false;
  end if;

  if v_row.use_count >= v_row.max_uses then
    return false;
  end if;

  update public.invite_codes
  set use_count = use_count + 1
  where id = v_row.id;

  return true;
end;
$$;

revoke all on function public.consume_invite_code(text) from public;
grant execute on function public.consume_invite_code(text) to service_role;

-- Local dev bootstrap code (100 uses, no expiry).
insert into public.invite_codes (code, max_uses, note)
values ('TEACHER-DEV', 100, 'Local development invite code')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile display_name" on public.profiles;

create policy "Users read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users update own profile display_name"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- history_entries: per-user
-- ---------------------------------------------------------------------------
alter table public.history_entries
add column if not exists user_id uuid references auth.users (id) on delete cascade;

delete from public.history_entries where user_id is null;

alter table public.history_entries
alter column user_id set not null;

create index if not exists history_entries_user_saved_at_idx
on public.history_entries (user_id, saved_at desc);

drop trigger if exists history_entries_trim_after_insert on public.history_entries;
drop function if exists public.history_entries_after_insert_trim ();

create or replace function public.trim_history_entries_for_user(
  p_user_id uuid,
  max_rows integer default 20
)
returns void
language plpgsql
as $$
begin
  if max_rows < 1 then
    return;
  end if;

  with stale as (
    select id
    from public.history_entries
    where user_id = p_user_id
    order by saved_at desc, id desc
    offset max_rows
  )
  delete from public.history_entries where id in (select id from stale);
end;
$$;

create or replace function public.history_entries_after_insert_trim()
returns trigger
language plpgsql
as $$
begin
  perform public.trim_history_entries_for_user(new.user_id, 20);
  return null;
end;
$$;

create trigger history_entries_trim_after_insert
after insert on public.history_entries
for each row
execute function public.history_entries_after_insert_trim();

drop policy if exists "Users select own history" on public.history_entries;
drop policy if exists "Users insert own history" on public.history_entries;
drop policy if exists "Users delete own history" on public.history_entries;

create policy "Users select own history"
on public.history_entries
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own history"
on public.history_entries
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users delete own history"
on public.history_entries
for delete
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: user-scoped paths
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated upload own report photos" on storage.objects;
drop policy if exists "Authenticated update own report photos" on storage.objects;
drop policy if exists "Authenticated delete own report photos" on storage.objects;

create policy "Authenticated upload own report photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated update own report photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Authenticated delete own report photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
