-- Passkeys for Teacher AI session lock (WebAuthn). Access only via service role / admin client.

create table if not exists public.session_passkeys (
  id uuid primary key default gen_random_uuid (),
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  aaguid text,
  created_at timestamptz not null default now()
);

alter table public.session_passkeys enable row level security;

-- Short-lived challenges for registration / authentication (serverless-safe).
create table if not exists public.session_webauthn_challenges (
  id uuid primary key default gen_random_uuid (),
  challenge text not null,
  expires_at timestamptz not null
);

alter table public.session_webauthn_challenges enable row level security;

create index if not exists session_webauthn_challenges_expires_at_idx
  on public.session_webauthn_challenges (expires_at);

create index if not exists session_passkeys_created_at_idx
  on public.session_passkeys (created_at desc);
