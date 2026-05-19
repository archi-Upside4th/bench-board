# Bench/Board

Smart Contract Security Benchmark for LLM Agents — public leaderboard + admin tooling.

Stack: Next.js (App Router) · Postgres · Drizzle ORM · Auth.js (GitHub OAuth).

## Quick start

```bash
pnpm install
cp .env.example .env.local
# fill in DATABASE_URL, AUTH_SECRET, AUTH_GITHUB_ID/SECRET, ADMIN_GITHUB_LOGINS
pnpm db:push       # create tables in your Postgres
pnpm db:seed       # load the original prototype data as run v1.0
pnpm dev
```

Open `http://localhost:3000/` for the public leaderboard and `/admin` to sign in.

## Environment

| Var | Notes |
|---|---|
| `DATABASE_URL` | Any Postgres URL — Neon, Supabase, local Docker, RDS. |
| `AUTH_SECRET` | `openssl rand -base64 32`. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | Create at https://github.com/settings/developers — callback `http://localhost:3000/api/auth/callback/github`. |
| `ADMIN_GITHUB_LOGINS` | Comma-separated GitHub usernames allowed into `/admin`. |

## Admin workflow

1. Sign in at `/login` (GitHub) — your username must be in `ADMIN_GITHUB_LOGINS`.
2. **Agents** (`/admin/agents`) — upsert / delete models. The `id` is the foreign key used by every result table; don't rename after import.
3. **Import run** (`/admin/runs/new`) — paste a complete JSON payload. New `runId` creates a fresh run; an existing `runId` replaces its result rows. The newest public run is what `/` displays.

## Hosting

Stack is portable. No Vercel-only packages — `postgres` driver instead of `@vercel/postgres`. Deploy targets that work out of the box:

- **Vercel + Neon** — connect via Vercel Marketplace, env vars auto-set.
- **Railway / Render / Fly** — set the same env vars manually.
- **Self-host** — `pnpm build && pnpm start` behind any node-compatible runtime.

## Database

Drizzle schema lives in [src/db/schema.ts](src/db/schema.ts). To evolve:

```bash
pnpm db:generate   # write a migration to ./drizzle
pnpm db:migrate    # apply it
# or for prototyping:
pnpm db:push       # sync schema directly without a migration file
pnpm db:studio     # GUI browser
```

## File layout

```
app/
  page.tsx                 public leaderboard
  layout.tsx               root (fonts, aurora bg)
  globals.css              extracted styles from the original prototype
  components/              Header, Hero, Leaderboard, ParetoChart, FpAnalysis, …
  login/                   GitHub sign-in
  admin/
    layout.tsx             auth wall + admin nav
    page.tsx               dashboard
    agents/page.tsx        agent CRUD
    runs/new/page.tsx      JSON import
  api/auth/[...nextauth]/  Auth.js handlers
src/
  auth.ts                  Auth.js v5 config + isAdmin helper
  middleware.ts            redirect /admin/* if unauth'd
  db/                      Drizzle schema + client
  lib/
    leaderboard.ts         server-side fetch for the public page
    actions.ts             server actions (upsertAgent, importRunFromJson, …)
scripts/
  seed.ts                  loads the original prototype JSON as run v1.0
bench-clear-leaderboard.html   original static prototype (kept for reference)
```
