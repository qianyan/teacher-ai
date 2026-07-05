-- Single-use invite codes (one person per code) + usage quotas / subscription prep.

-- ---------------------------------------------------------------------------
-- invite_codes: bind redemption to user, enforce one-time use
-- ---------------------------------------------------------------------------
alter table public.invite_codes
add column if not exists redeemed_by_user_id uuid references auth.users (id) on delete set null,
add column if not exists redeemed_at timestamptz;

-- Normalize existing rows to single-use.
update public.invite_codes set max_uses = 1 where max_uses <> 1;

alter table public.invite_codes
drop constraint if exists invite_codes_max_uses_check;

alter table public.invite_codes
add constraint invite_codes_max_uses_check check (max_uses = 1);

alter table public.invite_codes
drop constraint if exists invite_codes_use_count_check;

alter table public.invite_codes
add constraint invite_codes_use_count_check check (use_count >= 0 and use_count <= 1);

create unique index if not exists invite_codes_redeemed_by_user_id_idx
on public.invite_codes (redeemed_by_user_id)
where redeemed_by_user_id is not null;

drop function if exists public.consume_invite_code(text);

create or replace function public.claim_invite_code(p_code text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes%rowtype;
begin
  if p_user_id is null then
    return false;
  end if;

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

  if v_row.use_count >= 1 or v_row.redeemed_by_user_id is not null then
    return false;
  end if;

  update public.invite_codes
  set
    use_count = 1,
    redeemed_by_user_id = p_user_id,
    redeemed_at = now()
  where id = v_row.id;

  return true;
end;
$$;

revoke all on function public.claim_invite_code(text, uuid) from public;
grant execute on function public.claim_invite_code(text, uuid) to service_role;

-- Remove shared multi-use dev code; create single-use codes via scripts/create-invite-code.ts
delete from public.invite_codes where lower(code) = lower('TEACHER-DEV');

insert into public.invite_codes (code, max_uses, note)
values ('LOCAL-DEV-01', 1, 'Single-use local bootstrap (replace via script)')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- profiles: subscription plan (pro = unlimited generates; free = quota)
-- ---------------------------------------------------------------------------
alter table public.profiles
add column if not exists plan text not null default 'free';

alter table public.profiles
drop constraint if exists profiles_plan_check;

alter table public.profiles
add constraint profiles_plan_check check (plan in ('free', 'pro'));

drop policy if exists "Users update own profile display_name" on public.profiles;

create policy "Users update own profile display_name"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and plan = (select p.plan from public.profiles p where p.id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- usage_events (monthly generate quota for free plan)
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_action_created_idx
on public.usage_events (user_id, action, created_at desc);

alter table public.usage_events enable row level security;

drop policy if exists "Users read own usage events" on public.usage_events;

create policy "Users read own usage events"
on public.usage_events
for select
to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- subscription_events (payment webhooks, Phase 2)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid (),
  external_event_id text not null unique,
  provider text not null default 'stripe',
  event_type text not null,
  payload_hash text,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.subscription_events enable row level security;
