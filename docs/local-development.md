# Local Development (Isolated Environment)

Local development uses a **separate Supabase stack in Docker**, not the preview/production project. This keeps history, passkeys, and report photos isolated from deployed environments.

## Prerequisites

- **Colima** (recommended on macOS): `brew install colima docker`
- Or [Docker Desktop](https://docs.docker.com/desktop/)
- Node.js 20+ and npm
- LLM API key (OpenAI-compatible or Anthropic)

Start Docker before provisioning:

```bash
colima start
docker context use colima
```

First run of `npm run provision:local` may take **5–10 minutes** while Supabase Docker images download.

On Colima, the provision script excludes `vector` and `analytics` containers (they require Docker socket mounts that Colima does not support). Core features (DB, Storage, Auth API) are unaffected.

## First-time setup

1. **Install dependencies**

   ```bash
   npm install
   npm run playwright:install
   ```

2. **Add LLM credentials** (optional if already in `.env.local`)

   ```bash
   cp .env.local.secrets.example .env.local.secrets
   # Edit .env.local.secrets — add LLM_API_KEY (and provider settings if needed)
   ```

3. **Provision local stack**

   ```bash
   npm run provision:local
   ```

   This will:

   - Start local Supabase via Docker (`http://127.0.0.1:54321`)
   - Apply migrations (history, WebAuthn tables, `report-photos` bucket)
   - Generate `.env.local` pointing at the local stack
   - Back up a remote `.env.local` to `.env.local.remote.bak` if detected

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Keep `WEBAUTHN_ORIGIN=http://localhost:3000` in `.env.local` (set automatically by provision).

## Daily commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run provision:local` | Reset local DB + regenerate `.env.local` |
| `npm run db:migrate:local` | Apply pending migrations locally (keeps data) |
| `npm run db:reset:local` | Wipe local DB only — never run in CI |
| `npm run supabase:status` | Show local URLs and keys |
| `npm run supabase:stop` | Stop Docker containers |
| `npm run supabase:start` | Start containers without reset |
| `npm run prepare:local` | Validate `.env.local` only |

Supabase Studio (local admin UI): run `npm run supabase:status` and open the Studio URL (default `http://127.0.0.1:54323`).

## What is isolated

| Resource | Local | Preview / Production |
| --- | --- | --- |
| Postgres + API | Docker (`127.0.0.1:54321`) | Remote Supabase project |
| Storage bucket | Local `report-photos` | Remote bucket |
| E2B long screenshots | Disabled (Playwright in-process) | Optional E2B on Vercel |
| Env file | `.env.local` (generated) | Vercel env / `.vercel/.env.*.local` |

## Switching back to remote Supabase

If you previously used the shared remote project locally:

```bash
cp .env.local.remote.bak .env.local
```

Or pull preview env: `npm run env:pull:preview` and point Next at `.vercel/.env.preview.local`.

## Troubleshooting

**Docker is not running**

```bash
colima start
docker context use colima
npm run provision:local
```

Or start Docker Desktop, wait until healthy, then retry.

**Port 3000 in use**

Stop the other process or run `npm run dev -- -p 3001` and set `WEBAUTHN_ORIGIN=http://localhost:3001`.

**Missing LLM key after provision**

Add keys to `.env.local.secrets` and re-run `npm run provision:local`, or edit `.env.local` directly.

**Reset local database only**

```bash
npm run db:reset:local
# or apply migrations without wiping data:
npm run db:migrate:local
```
