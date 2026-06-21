# Ecosystem: Pre-Migration Gate

- Version: 1.0
- Status: **Go — cleared for migrations**
- Date: 2026-06-20
- Purpose: single go/no-go checkpoint before generating Supabase migrations. All items below must be closed before any SQL is written.

---

## Verdict

**Go.** All ADRs accepted, all spec open items closed, reconciliation pass clean. Migrations can generate straight from `domain-model-v1.md`.

---

## ADRs — all accepted

| ADR | Decision |
|---|---|
| 0001 | Org scoping and clone strategy. `org_id` on every table, RLS enforced, clone = fresh org. |
| 0002 | Unmatched email participants → `email_participant_reviews` queue. No auto stub profiles. |
| 0003 | Email metadata org-wide; bodies owner/admin only. `organisations.email_access_level` defaults to `restricted_body_access`. |
| 0004 | Import dedup: email = auto-merge, name+company = review queue, else new profile. Never auto-merge on name alone. |
| 0005 | Orbit recency: Active 0–6 months, Reconnect 6–9 months, Dormant 9+ months. Config-driven. |
| 0006 | Search: Postgres FTS (Phase 1), pgvector optional (Phase 2). No external search infra in V1. |
| 0007 | Gmail sync is Ecosystem-owned. Dedicated cron, not shared with Pathway PM. |
| 0008 | Google Calendar sync: `calendar_sync` reserved in `activities.source` enum; `calendar_accounts` + `calendar_events` table shapes defined for Phase 1.1. |

---

## Post-gate additions (after 2026-06-20)

These were accepted after the gate cleared. They do not invalidate the gate verdict for Phase 1 migrations, but any new Cursor session should treat them as closed decisions:

| ADR | Decision |
|---|---|
| 0009 | Phase 3 agent workflows (meeting intelligence, relationship health, event prep, intro facilitation). Calendar sync is prerequisite — now shipped (Phase 1.1, 2026-06-21). |

**Phase 1.1 calendar migrations** (`20260621100000_calendar.sql`) applied 2026-06-21. Tables live; cron and OAuth handlers shipped. Pipeline spec: `docs/specs/calendar-sync.md`. Review UI spec: `docs/specs/admin-review.md` §4.

### calendar-sync.md (post-ship)

| Item | Decision |
|---|---|
| Sync windows | 12 months back, 3 months forward; purge beyond lookahead each run |
| Internal filter | `ORG_INTERNAL_EMAIL_DOMAINS` + `users.email` via `participant-email.ts` |
| Review table | `calendar_participant_reviews` (not `email_participant_reviews`) |
| Manual purge | `npm run purge:calendar` for dev cleanup without full sync |

---

## Spec open items — all closed

### gmail-sync.md

| Item | Decision |
|---|---|
| Label configuration | `GMAIL_SYNC_LABELS` env var. Set in `.env.local` before first sync. Admin UI deferred to Phase 1.1. |
| Backfill window | 12 months on first connect, incremental daily after. Batch to avoid rate limits. |
| Auto-suggest relationship owner | No in V1. Owner management is manual. |
| Sync audit logging | `sync_runs` table preferred; `gmail_accounts.metadata.last_run` acceptable in V1. |

### import-pipeline.md

| Item | Decision |
|---|---|
| Staging | Dedicated `import_rows` table. Not jsonb. |
| Soft match algorithm | Exact `lower(full_name) + lower(organisation_name)` in V1. Trigram in Phase 1.1. |
| Email match overwrite | Fill empty fields only. Never overwrite curated data. |
| File size limits | 10 MB / 5,000 rows in V1. Enforce at upload. |

---

## Reconciliation pass

Checked against `docs/domain-model-v1.md` on 2026-06-20.

| Check | Result |
|---|---|
| `relationship_sources` (provenance) and `activities` (timeline) are distinct | ✅ Pass |
| Section numbering 5.1–5.13 internally consistent; entity map matches table list | ✅ Pass |
| `email_threads.gmail_account_id` FK to `gmail_accounts` present | ✅ Pass |
| `email_participant_reviews` is queue-only; profiles created on admin action only | ✅ Pass |
| `organisations.email_access_level` present, defaults to `restricted_body_access` | ✅ Pass |
| No `profiles.needs_review` column (superseded by `email_participant_reviews` per ADR 0002) | ✅ Pass — column correctly absent; earlier gate doc checklist item was stale |
| `gmail_thread_id` and `gmail_message_id` uniqueness scoped per org | ✅ Pass |
| Orbit recency bands match ADR 0005 (0–6 / 6–9 / 9+) | ✅ Pass |
| All tables have `org_id`; ingested tables have `source` / `source_ref` | ✅ Pass |
| No subjective scoring columns (Influence, Trust, Warmth etc.) in any user-facing table | ✅ Pass |

**10/10 pass.** One stale note: the gate doc draft referenced `profiles.needs_review` — this was correctly dropped in favour of the `email_participant_reviews` approach when ADR 0002 was accepted. No schema change required.

---

## Migration generation sequence

Generate in dependency order. Foreign keys resolve cleanly in this order.

**Phase 1 (ship with)**

1. `organisations`, `users`
2. `profiles`, `tags`, `profile_tags`
3. `relationships`, `relationship_owners`, `relationship_sources`
4. `connections`
5. `events`, `event_attendees`
6. `gmail_accounts`, `email_threads`, `email_messages`, `email_participant_reviews`
7. `activities` (references profiles; `source_ref` links to threads and events)
8. `imports`, `import_rows`
9. RLS policies per table, including the two-tier email body policy (metadata vs body split per ADR 0003)
10. Full-text search indexes (tsvector columns, GIN indexes) for Phase 1 search

**Phase 2 (can defer)**

11. Views: relationship strength, orbit ring, last_interaction, connect suggestions

Views are read-only derived concepts. They do not block Phase 1 functionality and can be added once real data is in place to validate the formulas.

---

## Does not block migrations

| Document | Why it can wait |
|---|---|
| `docs/design-tokens.md` | Wants 2–3 hero screens first; schema-independent |
| `docs/ai-strategy.md` | Phase 3; hooks already in schema via `source` / `source_ref` |
| `docs/specs/orbit-interaction.md` | Phase 2 UX; Orbit reads from views, not new tables |

---

## Status update — 2026-06-20

**Phase 1 migrations complete.** 11 migration files applied to remote Supabase. Auth scaffolding is in place (Supabase clients, `requireUser()`, login flow, users row bootstrap on first sign-in).

**Schema is now locked.** The schema-locked rule in `.cursor/rules/supabase.mdc` is active. Do not suggest new tables or columns without an explicit ADR.

**Next steps:**
1. Write `supabase/seed.sql` — PU org row, team users, sample profiles, relationships in each state, a pending import, email review rows (see `docs/build-quality.md §1`)
2. UI foundation — `@theme` tokens in `globals.css`, shadcn/ui init, `src/config/owner-colours.ts`, app shell with sidebar
3. Phase 1 feature build — Profiles → Relationships → Tags → Search → Events → Import → Gmail sync
