# Caffeine handover — Ecosystem

This repository is the **Caffeine Daily** instance of Ecosystem — relationship intelligence for the Caffeine team. Team data, seed content, and branding are configured for Caffeine (not a multi-tenant SaaS).

**Handover owner:** Ria  
**Prepared:** June 2026

---

## Before Chris hands over

These items are **outside the repo** but block Ria from going live:

1. **Supabase org row** — Update or recreate so `name` / `slug` match `team-members.json` (`Caffeine Daily` / `caffeine-daily`). If the project still contains legacy seed data from another tenant, prefer a **fresh Supabase project** (see setup below).
2. **Vercel project** — Link this repo to a Caffeine deployment (or rename/reconfigure). Update env vars; register Caffeine redirect URLs in Google OAuth.
3. **Google Cloud OAuth** — Internal app for `@caffeine.co`. Replace any legacy OAuth client IDs in `.env.local` / Vercel with Caffeine GCP credentials.
4. **Run `npm run sync:team`** against the target Supabase project after Ria confirms team roster in `team-members.json`.
5. **Secrets** — Do not commit `.env.local`. Ria copies `.env.example` → `.env.local` and fills in **new** Caffeine credentials (not Chris's PU Supabase/Google/Vercel tokens). Optional: `.cursor/mcp.json` for Supabase MCP — see `.cursor/mcp.json.example`.

---

## Start here

1. Open **[SETUP.md](../SETUP.md)** in Cursor and run: *Help me set up Ecosystem locally — follow SETUP.md step by step.*
2. Copy [.env.example](../.env.example) to `.env.local` and fill in values (SETUP Phase 2).
3. Ensure the `organisations` row in Supabase matches `src/config/team-members.json` (`name`, `slug`).
4. Run `npm run sync:team` after any team changes in `team-members.json`.

Full checklist, troubleshooting, and Cursor prompts: **[SETUP.md](../SETUP.md)**

---

## Single source of truth for tenant identity

| What | Where |
|---|---|
| Org name, slug, team roster | `src/config/team-members.json` |
| Typed exports for the app | `src/config/team-members.ts` |
| Local seed org + dev auth | `supabase/seed.sql` |
| Bootstrap slug on first sign-in | `DEFAULT_ORG_SLUG` env var |
| Internal email domains (sync) | `ORG_INTERNAL_EMAIL_DOMAINS` env var |

**Rule:** Never hard-code the org name or team emails outside these files and the `organisations` row.

Current defaults:

- Org: **Caffeine Daily** (`slug: caffeine-daily`)
- Internal domain: **caffeine.co**
- Dev login (local only): `rs@caffeine.co` / `password123`

---

## Environment checklist

Copy `.env.example` → `.env.local`. Required for local dev:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / RSC client |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts, cron, sync jobs |
| `DEFAULT_ORG_SLUG` | Must be `caffeine-daily` (match seed + `team-members.json`) |
| `ORG_INTERNAL_EMAIL_DOMAINS` | e.g. `caffeine.co` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally |
| `TOKEN_ENCRYPTION_KEY` | OAuth refresh token encryption |
| `CRON_SECRET` | Protects `/api/cron/*` routes |

Calendar sync (Phase 1.1 — shipped):

- `GOOGLE_CALENDAR_CLIENT_ID` / `SECRET` / `REDIRECT_URI`
- Register redirect URIs for localhost and your Vercel domain in Google Cloud Console

Gmail sync (schema ready — not implemented):

- `GOOGLE_GMAIL_*` vars documented in `.env.example`

---

## Supabase setup

### Option A — Fresh Caffeine project (recommended for production)

1. Create a new Supabase project (no foreign tenant data).
2. Run migrations: `supabase db push` or link project and deploy migrations.
3. Insert org row (or reset local DB with seed):

```sql
insert into public.organisations (id, name, slug, email_access_level)
values (
  '11111111-1111-1111-1111-111111111111',
  'Caffeine Daily',
  'caffeine-daily',
  'restricted_body_access'
);
```

4. Run `npm run sync:team` to provision auth + `public.users` from `team-members.json`.

### Option B — Local dev with seed

```bash
supabase db reset   # applies migrations + seed.sql
npm run sync:team   # ensures auth.users match team-members.json
npm run dev
```

---

## Adding Caffeine team members

1. Edit `src/config/team-members.json` — add `id` (stable UUID), `email`, `fullName`, `role`, `colourToken`.
2. Add a matching `--color-owner-*` token in `src/app/globals.css` if they need a distinct owner colour.
3. Run `npm run sync:team`.
4. For Google sign-in: add the user in Supabase Auth (or let them sign in with Google if their `@caffeine.co` account is allowed).

Promote to admin:

```sql
update public.users set role = 'admin'
where lower(email) = 'someone@caffeine.co';
```

---

## Google OAuth

Set up a dedicated Google Cloud project and OAuth clients for Caffeine:

1. A Google Cloud project (Internal app type if using Google Workspace `@caffeine.co`).
2. OAuth clients for Calendar (and Gmail when implemented).
3. Redirect URIs for each deployment environment.
4. New client IDs/secrets in Vercel env vars.

---

## Vercel / deployment

- Link this repo to a **new** Vercel project (or rename the existing one) for Caffeine.
- Set all env vars from the checklist in Vercel (Production + Preview).
- Confirm `DEFAULT_ORG_SLUG=caffeine-daily` matches the Supabase `organisations.slug`.
- Cron routes require `CRON_SECRET`.

---

## What's already built (Phase 1)

- Org-scoped schema with RLS
- Profile CRUD, search (FTS), import pipeline, admin review queues
- Google Calendar sync (Phase 1.1)
- Gmail schema only — sync **not** implemented ([specs/gmail-sync.md](./specs/gmail-sync.md))

---

## Suggested next steps for Ria

1. Confirm Caffeine org name, slug, and email domain with the team — update `team-members.json` if needed.
2. Stand up fresh Supabase + Vercel with Caffeine env vars.
3. Add the full Caffeine team to `team-members.json` and run `sync:team`.
4. Connect Google Calendar from Admin and run first sync/backfill.
5. Import initial contacts via Admin → Import.
6. Run the org isolation check in [build-quality.md](./build-quality.md) §6 once live.

---
