create extension if not exists pgcrypto;

create table if not exists public.history_entries (
  id uuid primary key default gen_random_uuid(),
  saved_at timestamptz not null default now(),
  snapshot_json jsonb not null
);

alter table public.history_entries enable row level security;

create index if not exists history_entries_saved_at_desc_idx
  on public.history_entries (saved_at desc);

create or replace function public.trim_history_entries(max_rows integer default 20)
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
  perform public.trim_history_entries(20);
  return null;
end;
$$;

drop trigger if exists history_entries_trim_after_insert on public.history_entries;
create trigger history_entries_trim_after_insert
after insert on public.history_entries
for each statement
execute function public.history_entries_after_insert_trim();
