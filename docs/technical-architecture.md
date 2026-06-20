# Ecosystem Technical Architecture

- Version: 1.0
- Status: Accepted
- Related: domain-model-v1.md, ai-conventions.md, docs/decisions/

This document answers **what lives where** before any SQL is written. Migrations implement this; they do not invent it.

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Next.js 15 (App Router)                       │  │
│  │  UI (React) │ Server Actions │ Route Handlers (API/cron)  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│    Supabase     │ │  Gmail API    │ │  Anthropic API  │
│  Auth + Postgres│ │  (OAuth)      │ │  (Phase 3 only) │
│  RLS + Storage  │ │               │ │                 │
└─────────────────┘ └───────────────┘ └─────────────────┘
```

| System | Responsibility | Phase |
|---|---|---|
| **Next.js UI** | Screens, forms, search, Orbit canvas, Admin queues | 1+ |
| **Server Actions** | Mutations: create profile, log activity, import commit, review queue actions | 1 |
| **Route Handlers** | Webhooks, cron endpoints, OAuth callbacks, long-running sync triggers | 1 |
| **Supabase Auth** | Login, session, `auth.users` | 1 |
| **Supabase Postgres** | All Layer 1 data, RLS, FTS indexes, SQL views (Layer 2) | 1 |
| **Supabase Storage** | CSV uploads pending import | 1 |
| **Cron (Vercel)** | Daily Gmail sync, optional nightly derived-view refresh | 1 |
| **Gmail API** | Incremental thread/message fetch for connected accounts | 1 |
| **Anthropic / Claude** | Search reasoning, relationship intelligence (Phase 3) | 3 |

---

## 2. Layer model (code ↔ data)

Three layers of truth from the domain model, enforced in folder structure:

| Layer | What | Where in code | Where in DB |
|---|---|---|---|
| **1 — Reality** | User-entered and ingested facts | `src/lib/data/` repositories | Tables: profiles, relationships, activities, … |
| **2 — Inference** | Computed strength, Orbit rings, Connect, last_interaction | `src/lib/computed/` + SQL views | Views only; no user-editable columns |
| **3 — AI** | Claude reasoning over graph | `src/lib/ai/` | `ai_interactions` log table (Phase 3) |

**Rule:** Layer 2 never writes Layer 1. Layer 3 never writes Layer 1 without explicit human confirmation.

---

## 3. Repository layout

```
Ecosystem/
├── AGENTS.md
├── docs/                          # Source-of-truth documentation
├── supabase/
│   ├── migrations/                # Schema only; no manual dashboard edits
│   ├── seed.sql                   # PU org, test users, sample graph
│   └── config.toml
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Login, OAuth callback
│   │   ├── (app)/                 # Authenticated shell + sidebar
│   │   │   ├── overview/
│   │   │   ├── search/
│   │   │   ├── profiles/
│   │   │   ├── events/
│   │   │   ├── connect/           # Phase 2
│   │   │   ├── orbit/             # Phase 2
│   │   │   ├── watchlist/         # Phase 2
│   │   │   └── admin/
│   │   │       ├── import/
│   │   │       └── review/
│   │   └── api/
│   │       ├── cron/
│   │       │   └── gmail-sync/    # Vercel cron target
│   │       └── oauth/
│   │           └── gmail/         # OAuth callback
│   ├── components/                # UI components (shadcn + domain)
│   │   ├── ui/                    # shadcn primitives
│   │   ├── profiles/
│   │   ├── search/
│   │   └── admin/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser client (anon key, RLS)
│   │   │   ├── server.ts          # Server client (cookies)
│   │   │   └── admin.ts           # Service role; cron/sync only
│   │   ├── auth/
│   │   │   └── session.ts         # getSession, getOrgId, requireUser
│   │   ├── data/                  # Layer 1 repositories
│   │   │   ├── profiles.ts
│   │   │   ├── relationships.ts
│   │   │   ├── activities.ts
│   │   │   └── ...
│   │   ├── computed/              # Layer 2 query functions
│   │   │   ├── orbit.ts
│   │   │   ├── connect.ts
│   │   │   └── search.ts
│   │   ├── integrations/          # External system adapters
│   │   │   └── gmail/
│   │   │       ├── client.ts
│   │   │       ├── sync.ts
│   │   │       └── match.ts
│   │   └── ai/                    # Phase 3; empty until then
│   ├── config/
│   │   └── relationship-thresholds.ts
│   └── types/
│       └── database.ts            # Generated; do not hand-edit
├── scripts/
│   ├── gen-types.sh
│   └── db-reset.sh
└── vercel.json                    # Cron schedule
```

---

## 4. Request flow patterns

### 4.1 Authenticated UI read

```
Browser → Next.js page (RSC) → createServerClient(cookies)
       → Supabase query with RLS → render
```

- Pages and server components use the **cookie-bound Supabase client**.
- RLS enforces org isolation. No `org_id` from the client.

### 4.2 User mutation (Server Action)

```
Browser form → Server Action → requireUser() → getOrgId()
            → validate (Zod) → repository write → revalidatePath
```

- All mutations go through Server Actions or Route Handlers, never direct client writes to sensitive tables.
- `org_id` is injected server-side on every insert.

### 4.3 Cron / background job

```
Vercel Cron → Route Handler → verify CRON_SECRET
           → createAdminClient() (service role)
           → sync job → upsert with natural keys
```

- Cron uses **service role** to bypass RLS for system writes.
- Jobs must still set `org_id` explicitly per org processed.
- Gmail sync: see `docs/specs/gmail-sync.md`.

### 4.4 OAuth (Gmail connect)

```
Admin UI → redirect to Google OAuth → callback Route Handler
        → store refresh_token on gmail_accounts → redirect to Admin
```

- Tokens stored encrypted, server-side only.
- Never exposed to browser or client bundle.

---

## 5. Supabase usage

### 5.1 Clients

| Client | Key | Used by | RLS |
|---|---|---|---|
| Browser | anon + user session | Client components (minimal) | Yes |
| Server | anon + cookies | RSC, Server Actions | Yes |
| Admin | service role | Cron, sync, import batch jobs | Bypassed |

Prefer server reads. Client-side Supabase only where interactivity requires it (realtime, optimistic UI).

### 5.2 Auth bootstrap

On first login after Supabase Auth signup:

1. Upsert `users` row: `id = auth.users.id`, `org_id` from invite metadata (V1: seeded PU org).
2. All subsequent requests resolve org via `users.org_id`.

### 5.3 RLS pattern

Every table: `org_id = (select org_id from users where id = auth.uid())`.

Exceptions (additional policies):

- **email_messages.body** — readable only if user is admin OR relationship owner for a matched profile on the thread (ADR 0003). Honour `organisations.email_access_level`.
- **Storage** — import CSV bucket scoped to org prefix.

### 5.4 Migrations discipline

- All schema changes via `supabase/migrations/*.sql`.
- Generate types after every migration: `supabase gen types typescript`.
- Seed script for local dev; never seed production with PU test data.

---

## 6. Integration boundaries

### 6.1 Gmail (dedicated, ADR 0007)

| Owns | Does not own |
|---|---|
| `gmail_accounts`, `email_threads`, `email_messages`, `email_participant_reviews` | Pathway PM project tasks, timelines, or shared sync |
| OAuth for Ecosystem-connected inboxes | Pathway Gmail tokens |
| Activity + relationship_source generation from threads | Pathway notification logic |

Spec: `docs/specs/gmail-sync.md`.

### 6.2 CSV import

| Owns | Does not own |
|---|---|
| Upload → preview → map → dedup → review → commit pipeline | Real-time Clay/Airtable API sync (future) |
| `imports` audit trail, soft-match review queue | Auto-merge on name |

Spec: `docs/specs/import-pipeline.md`.

### 6.3 Search

| Owns | Does not own |
|---|---|
| Postgres FTS indexes, ranked results UI | External search service (Phase 2+ pgvector if needed) |
| Evidence-rich result cards | AI-generated summaries (Phase 3) |

ADR: 0006. Spec: `docs/specs/search.md`.

### 6.4 Claude (Phase 3)

| Owns | Does not own |
|---|---|
| `src/lib/ai/` gateway, prompt templates, eval set | Direct DB writes to Layer 1 |
| `(context, action, outcome)` logging | User-facing chat in V1/V2 |

All model calls go through a single internal AI gateway for logging, provider swap, and rate limiting.

---

## 7. Cron jobs

| Job | Schedule | Handler | Purpose |
|---|---|---|---|
| `gmail-sync` | Daily (e.g. 02:00 UTC) | `api/cron/gmail-sync` | Incremental fetch for all `sync_enabled` accounts |
| `refresh-search-indexes` | Optional weekly | `api/cron/search-refresh` | Reindex FTS if needed |

Vercel cron config in `vercel.json`. Protected by `CRON_SECRET` header check.

Sync is **incremental** using Gmail `historyId` stored on `gmail_accounts.sync_cursor`. Full backfill runs once on account connect.

---

## 8. Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | App | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | App | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron, import jobs | Server only |
| `CRON_SECRET` | Cron routes | Verify Vercel cron |
| `GOOGLE_CLIENT_ID` | Gmail OAuth | Server only |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth | Server only |
| `GOOGLE_OAUTH_REDIRECT_URI` | Gmail OAuth | Callback URL |
| `TOKEN_ENCRYPTION_KEY` | Gmail token storage | Server only |
| `GMAIL_SYNC_LABELS` | Gmail sync label filter | Server only; comma-separated label names/IDs |
| `ANTHROPIC_API_KEY` | Phase 3 AI | Server only |

Validated at boot via Zod in `src/lib/env.ts`. Fail fast on missing required vars.

---

## 9. Deployment

| Environment | Supabase | Purpose |
|---|---|---|
| **Local** | Supabase CLI / Docker | Development, migrations, seed |
| **Preview** | Branch or staging project | PR previews |
| **Production** | Production project | PU live instance |

Caffeine clone: new Supabase project (or new `org_id`), same migrations, empty data (ADR 0001).

---

## 10. What not to build in Phase 1

- Shared Gmail sync with Pathway PM
- AI gateway or Claude integration
- pgvector / semantic search
- Real-time subscriptions (unless search demands it)
- Microservices or separate API server
- Custom auth beyond Supabase

---

## 11. Sign-off checklist

- [x] Layer boundaries agreed (§2, §3)
- [x] Supabase client patterns agreed (§5)
- [x] Gmail owned by Ecosystem, not Pathway (§6.1, ADR 0007)
- [x] Cron approach agreed (§7)
- [x] Env vars listed (§8)
- [x] Domain model entity map matches this doc

All items signed off 2026-06-20. See `docs/pre-migration-gate.md` for the full gate record. Generate migrations from `docs/domain-model-v1.md`.
