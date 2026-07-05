-- Passkeys are managed by Supabase Auth; drop legacy session-lock tables.

drop table if exists public.session_webauthn_challenges;
drop table if exists public.session_passkeys;
