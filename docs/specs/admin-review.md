# Admin Review Queues Specification

- Version: 1.0
- Status: Accepted
- Related: ADR 0002, ADR 0004, `docs/specs/gmail-sync.md` §11, `docs/specs/calendar-sync.md` §7, `docs/specs/import-pipeline.md`, information-architecture.md §Admin

The daily workhorse screens in the first months post-launch. Three review surfaces share the same mental model: **something sync/import found → human decides link, create, or ignore.** This spec covers the combined admin UX, access control, and actions. Individual pipeline details remain in the source specs.

---

## 1. Purpose

Grow the relationship graph without noise. Unmatched email participants, unmatched calendar attendees, and import soft-matches all need human judgment before becoming profiles or relationships. Admin review is the gate.

---

## 2. Access control

| Rule | Implementation |
|---|---|
| Who can access | **Admins only** — every review route calls `requireAdmin()` |
| RLS | Review tables are org-scoped (any org member can SELECT at DB level); UI enforcement is app-layer |
| Clone safety | No hard-coded PU IDs; all queries scoped by `getOrgId()` |

Routes:

| Queue | Path | Status |
|---|---|---|
| Calendar participants | `/admin/calendar-sync/review` | Shipped |
| Import soft-matches | `/admin/import/[id]` (within import wizard) | Shipped |
| Email participants | `/admin/email-sync/review` (or equivalent) | **Not yet built** — spec in gmail-sync.md §11; queue table exists |

Admin hub: `/admin` links to each surface. Sub-nav via `src/config/admin-navigation.ts`.

---

## 3. Shared UX patterns

Apply consistently across all review queues:

### 3.1 Row information

Each review item shows at minimum:

- Participant identifier (email + display name when known)
- Source context (thread subject, meeting title, import row, or event date)
- Source account or import filename
- Date of evidence

### 3.2 Actions (ADR 0002 pattern)

| Action | Result |
|---|---|
| **Link to existing profile** | Set `profile_id`, update status. Backfill activity and/or relationship_source. |
| **Create profile** | New profile + relationship. Link review row. Backfill evidence. |
| **Ignore** | `status=ignored`. Optionally add to ignore list (Gmail — deferred, see gmail-sync.md §12). |

Never auto-create profiles from sync/import without explicit admin action.

### 3.3 Grouping

- **Calendar:** group pending `calendar_participant_reviews` by email; show meeting count and sample title.
- **Email (planned):** group by email across threads where applicable.
- **Import:** per-row soft matches in import detail wizard.

### 3.4 Internal / team filtering

Calendar review separates **external** unmatched participants from **internal** (PU team) addresses:

- External: full link / create / ignore actions.
- Internal: collapsed section; "Ignore all team" bulk action. Team addresses should not become external profiles.

Uses same internal filter as sync: `ORG_INTERNAL_EMAIL_DOMAINS` + `users.email`.

### 3.5 Empty states

When queue is empty: explain what populates it and link to connect settings (OAuth) or import.

### 3.6 Post-connect messaging

After OAuth connect, redirect with `?connected=[email]` query param. Show "Initial sync is running — refresh in a minute" banner.

---

## 4. Calendar sync review (shipped)

**Path:** `/admin/calendar-sync/review`

**Components:** `CalendarSyncReviewWizard`, data from `src/lib/data/calendar-sync-review.ts`

### Summary panel

- Sync in progress flag
- Last run timestamp
- Counts: events processed, activities created, reviews pending
- Split: external vs internal pending counts

### Tabs

1. **Unmatched** — external groups with link/create/ignore per email
2. **Matched** — recent auto-linked meetings for audit (read-only)
3. **Team (internal)** — collapsed; bulk ignore

### Link flow

1. Admin searches profiles by name/email (`searchProfilesForCalendarLinkAction`)
2. Select profile → `linkCalendarReviewAction`
3. Backfill meeting activity on linked profile

### Create flow

1. Pre-fill name from calendar display name, email from review row
2. `createProfileFromCalendarReviewAction`
3. Creates profile, relationship, links all pending review rows for that email

---

## 5. Import soft-match review (shipped)

**Path:** `/admin/import/[id]` during `processing` status

**Component:** `SoftMatchReview`

Per ADR 0004:

| Dedup tier | Behaviour |
|---|---|
| Email match | Auto-merge at commit (fill empty fields only) |
| Name + company soft match | **Review queue** — admin confirms merge or creates new |
| No match | New profile at commit |

Soft-match rows show: import row data, candidate existing profile, side-by-side diff. Actions: merge, create new, skip.

Full import flow: `docs/specs/import-pipeline.md`.

---

## 6. Email participant review (planned)

**Spec source:** `docs/specs/gmail-sync.md` §11

**Table:** `email_participant_reviews`

When built, mirror calendar review patterns:

- Admin → Review → Email participants
- Same three actions: link, create, ignore
- Show thread subject, date, syncing account
- Group by email where multiple threads pending

Blocked on Gmail sync route handler shipping. Queue table and RLS already exist.

---

## 7. Pagination and scale

V1 limits:

- Calendar unmatched groups: capped at query limit (see `listPendingCalendarReviewGroups`)
- Import soft matches: all rows for one import (max 5,000 rows per import per import-pipeline spec)
- No infinite scroll in V1; add pagination when any queue routinely exceeds 100 items

---

## 8. Keyboard shortcuts

**Deferred to Phase 1.1 UX polish.** V1 is mouse-driven. When added:

- `j` / `k` — move between rows
- `l` — link, `c` — create, `i` — ignore
- Document in this spec when implemented

---

## 9. Acceptance criteria

- [ ] Non-admin receives 403 or redirect from all review routes
- [ ] Calendar review: link action backfills meeting activity idempotently
- [ ] Calendar review: create action does not duplicate profile on same email
- [ ] Calendar review: ignore all team clears internal pending rows
- [ ] Import soft-match: merge never overwrites non-empty curated fields (ADR 0004)
- [ ] All review actions log `reviewed_by` where schema supports it
- [ ] Empty queues show teaching empty states with links to connect/import
