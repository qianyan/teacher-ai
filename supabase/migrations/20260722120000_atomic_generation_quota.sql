-- ---------------------------------------------------------------------------
-- Atomic generation quota (fixes check-then-act race in /api/generate)
-- ---------------------------------------------------------------------------
-- Previously the app counted usage_events, ran the LLM generation, then
-- inserted a usage row - concurrent requests all passed the check before any
-- row existed, so the free-tier monthly limit was trivially bypassed.
-- try_consume_generation makes check + record atomic per user: an advisory
-- transaction lock keyed by user id serializes concurrent calls, the monthly
-- count is re-checked under that lock, and the usage row is inserted in the
-- same transaction. Returns the new usage_events id, or null when the quota
-- is exhausted. Pro plan users always pass (usage is still recorded).
-- The app calls this before generation and refunds (deletes) the row if
-- generation fails, preserving the old "only successful generations count"
-- behavior.
create or replace function public.try_consume_generation(p_user_id uuid, p_limit integer)
returns uuid
language plpgsql
security definer
set search_path = public
set timezone = 'UTC'
as $$
declare
  v_plan text;
  v_count integer;
  v_event_id uuid;
  v_month_start timestamptz;
begin
  if p_user_id is null then
    return null;
  end if;

  -- Serialize concurrent quota consumption per user for this transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Missing profile row => treat as free plan (mirrors app fallback).
  select p.plan into v_plan
  from public.profiles p
  where p.id = p_user_id;

  if coalesce(v_plan, 'free') <> 'pro' then
    -- UTC month start, matching the app's getUsageSummary window.
    v_month_start := date_trunc('month', now());

    select count(*) into v_count
    from public.usage_events
    where user_id = p_user_id
      and action = 'generate'
      and created_at >= v_month_start;

    if v_count >= greatest(coalesce(p_limit, 0), 0) then
      return null;
    end if;
  end if;

  insert into public.usage_events (user_id, action)
  values (p_user_id, 'generate')
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.try_consume_generation(uuid, integer) from public;
grant execute on function public.try_consume_generation(uuid, integer) to service_role;
