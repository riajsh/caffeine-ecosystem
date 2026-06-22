# Cursor Brief: Audit Fix Session

This brief covers the remaining issues from a 7-agent codebase audit. Issues marked ✅ have already been fixed and are listed for context only. Issues marked 🔧 need your attention.

Read `docs/ai-conventions.md` and `docs/technical-architecture.md` before starting. No schema changes in this session — this is all application-layer fixes.

---

## Already fixed (do not re-fix)

✅ #3/#4 — `syncing: true` stuck forever: purge calls and `syncing: true` update moved inside try block; retry path wrapped in try/catch so finally always runs cleanup (`src/lib/integrations/calendar/sync.ts`).

✅ #7 — `timingSafeEqual` comparing base64url text bytes instead of decoded bytes (`src/lib/integrations/google/oauth-state.ts`).

✅ #11 — OTP/invite path missing `isAllowedLoginEmail()` check (`src/app/auth/confirm/route.ts`).

✅ #21 — Dead conditional in `parseParticipants`: both branches returned `"accepted"`. Fixed to `"needsAction"` for non-self organiser (`src/lib/integrations/calendar/sync.ts`).

✅ #25 — `window.history.replaceState` in tab switcher bypassed Next.js router. Replaced with `router.replace(url, { scroll: false })` (`src/components/profiles/profile-detail-tabs.tsx`).

✅ #33 — Cron secret comparison not constant-time. Fixed with `timingSafeEqual` (`src/app/api/cron/calendar-sync/route.ts`).

---

## Critical — fix in this session

### 🔧 #1 — Backfill runs in `after()` hook, silently truncated on serverless recycle

**File:** `src/lib/integrations/calendar/sync.ts` (around line 59 — the `after()` call for initial backfill)

**Problem:** The initial full backfill (12-month history) is triggered via Next.js `after()` inside the OAuth callback. Vercel serverless functions have a fixed execution window. If the function is recycled mid-backfill, the process is killed silently — no error, no retry, the calendar account just has partial or zero data.

**Fix:** Remove the `after()` backfill trigger from the OAuth callback. Instead:
1. On OAuth connect, set a `needs_backfill: true` flag on the `calendar_accounts` row (or set `sync_cursor = null` which already signals full sync).
2. The daily cron (`api/cron/calendar-sync`) already calls `syncAllCalendarAccounts()`. It should detect `sync_cursor = null` as a backfill needed and run the full sync.
3. The cron has the full execution window Vercel allocates to cron jobs (no per-request timeout).

If you need the backfill to feel immediate to the admin, show a banner on connect: "Initial sync is running — calendar meetings will appear after the next sync (usually within a few minutes)." Do not try to run a backfill synchronously or in a background hook.

---

### 🔧 #2 — N+1 queries in `match.ts`: ~6 serial DB calls per participant per event

**File:** `src/lib/integrations/calendar/match.ts` (around line 101)

**Problem:** For each participant in each calendar event, the matching function makes individual DB queries to look up the profile, check if an activity exists, check if a relationship_source exists, etc. With 50 events × 10 attendees = ~500 participants, this is 3,000 round-trips. It will hit the Vercel function timeout on first connect.

**Fix:** Pre-fetch once at the start of the sync batch:
```ts
// Before the event loop — fetch all org profiles into a Map keyed by lower(email)
const { data: orgProfiles } = await supabase
  .from("profiles")
  .select("id, email, org_id")
  .eq("org_id", account.org_id)
  .not("email", "is", null);

const profilesByEmail = new Map(
  (orgProfiles ?? []).map(p => [p.email!.toLowerCase(), p])
);
```

Pass `profilesByEmail` into the match function instead of querying inside the loop. For the activity/relationship_source existence checks, use `ON CONFLICT DO NOTHING` upserts rather than check-then-insert patterns — this collapses the check + insert into a single round-trip.

---

### 🔧 #5 — Shared mutable summary object in concurrent import workers

**File:** `src/lib/data/imports.ts` (around line 1091)

**Problem:** 8 concurrent workers share a mutable `summary` object. Counter increments (`summary.created += 1`) are not atomic across `await` points. When two workers interleave on the same counter at the same microsecond, one increment is lost.

**Fix:** Each worker accumulates its own local counter object, then the results are summed after `Promise.all` resolves:
```ts
const workerResults = await Promise.all(
  batches.map(async (batch) => {
    const local = { created: 0, updated: 0, skipped: 0, errors: 0 };
    for (const row of batch) {
      // ... process row, increment local.*
    }
    return local;
  })
);

const summary = workerResults.reduce(
  (acc, r) => ({
    created: acc.created + r.created,
    updated: acc.updated + r.updated,
    skipped: acc.skipped + r.skipped,
    errors: acc.errors + r.errors,
  }),
  { created: 0, updated: 0, skipped: 0, errors: 0 }
);
```

---

### 🔧 #6 — Single malformed event causes HTTP 500 for the entire cron run

**File:** `src/app/api/cron/calendar-sync/route.ts` (line 23) and `src/lib/integrations/calendar/sync.ts`

**Problem:** If one calendar event fails to parse or upsert, it throws and the entire cron run returns HTTP 500. Vercel cron schedulers may retry immediately, causing a retry loop if the bad event is persistent.

**Fix:** Event-level errors are already caught inside the inner `try/catch` in the event loop (they push to `stats.errors` and continue). The problem is that `syncAllCalendarAccounts` propagates account-level failures up as a thrown exception, which makes the route return 500.

In the cron route, treat partial success as 200 (not 500):
```ts
// In route.ts, change the response logic:
return NextResponse.json(
  {
    ok: true,
    accountsProcessed: result.accountsProcessed,
    stats: result.stats,
    // errors are informational — the cron ran to completion
    warnings: result.stats.errors.length > 0 ? result.stats.errors : undefined,
  },
  { status: 200 },  // always 200 for partial success
);
```

Only return 500 if the entire sync function threw (caught by the outer `catch` in the route) — meaning the cron itself couldn't start, not that individual events failed.

---

## Medium — fix in this session if time allows, otherwise next session

### 🔧 #8 — `listProfiles()` fetches every profile with no limit

**File:** `src/lib/data/profiles.ts` (around line 408)

**Problem:** Called on every profiles page load with 314+ profiles, each with nested relationships. No pagination, no limit. Will slow as the org grows.

**Fix:**
1. Add `limit` and `offset` (or cursor-based) pagination to `listProfiles()`.
2. Add a separate `listProfileIds()` function that returns only `id, full_name, email` for use in search/autocomplete paths — avoids loading full nested data when only IDs are needed.
3. Default page size: 50. The profiles table UI should show a "Load more" button or URL-based pagination.

---

### 🔧 #9 — `recency.ts` fetches all org activities in JS to find latest-per-profile

**File:** `src/lib/computed/recency.ts` (around line 14)

**Problem:** Fetches every activity row for the org and computes latest-per-profile in JavaScript. With 314 profiles each having 20+ activities, this is 6,000+ rows loaded into memory on every call.

**Fix:** Replace with a Postgres `DISTINCT ON` query:
```sql
SELECT DISTINCT ON (profile_id) profile_id, activity_date
FROM activities
WHERE org_id = $1
ORDER BY profile_id, activity_date DESC
```

Expose this as an RPC function `get_last_activity_per_profile(org_id uuid)` so it uses the existing `(org_id, profile_id, activity_date)` index.

---

### 🔧 #10 — `connectionExists()` pre-check before upsert is redundant

**File:** `src/lib/computed/infer-connections.ts` (around line 21)

**Problem:** Calls `connectionExists()` before every insert to avoid duplicates. The `connections` table already has a unique constraint and the insert uses `ON CONFLICT DO NOTHING` — so the pre-check just adds a round-trip with no benefit.

**Fix:**
1. Remove the `connectionExists()` pre-check calls.
2. Parallelize `inferCoAttendanceForOrg` with `Promise.all` — the individual event inferences are independent.

---

### 🔧 #12 — `sync.ts` detects 410 (invalid sync token) by string match

**File:** `src/lib/integrations/calendar/sync.ts` (around line 258)

**Problem:** `message.includes("Sync token is no longer valid")` — fragile string match that will silently stop working if Google changes the error message.

**Fix:** Check the HTTP status code directly:
```ts
import { GaxiosError } from "gaxios";

// In the catch block:
const isExpiredToken =
  (error instanceof GaxiosError && error.response?.status === 410) ||
  message.includes("Sync token is no longer valid"); // fallback
```

---

### 🔧 #13 — No rate-limit backoff in calendar sync

**File:** `src/lib/integrations/calendar/sync.ts` (around line 316)

**Problem:** No handling for 429 responses from the Google Calendar API. On rate limit, the cron retries immediately, which triggers another 429.

**Fix:** Add exponential backoff for 429 responses. Since this is a cron job and not interactive, the simplest approach is to catch 429 and return early with a `rateLimited: true` flag in stats rather than retrying in the same run — the next day's cron will retry naturally:
```ts
if (error instanceof GaxiosError && error.response?.status === 429) {
  stats.errors.push("Rate limited by Google Calendar API — will retry on next run");
  return stats;
}
```

---

### 🔧 #15 — `scryptSync` blocks event loop on every token decrypt

**File:** `src/lib/integrations/google/crypto.ts` (around line 14)

**Problem:** `scryptSync` (~100ms, synchronous) re-runs on every token decryption. For a cron that processes 5 accounts, this is 500ms of blocked event loop.

**Fix:** Cache the derived key after first derivation:
```ts
let cachedKey: Buffer | null = null;

function getDerivedKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = scryptSync(getEncryptionSecret(), SALT, KEY_LENGTH) as Buffer;
  return cachedKey;
}
```

The key is deterministic (same secret + salt = same key), so caching is safe within a function invocation.

---

### 🔧 #16 — Missing database indexes

**File:** New migration file

**Problem:** Several queries do full org-scoped table scans because indexes are missing.

**Create a new migration** `supabase/migrations/YYYYMMDDHHMMSS_perf_indexes.sql`:
```sql
-- Activities filtered by source (sync queries, admin views)
create index if not exists activities_org_source_idx
  on activities (org_id, source);

-- Relationship sources filtered by type and source_id
create index if not exists relationship_sources_org_type_idx
  on relationship_sources (org_id, source_type, source_id);
```

---

### 🔧 #17 — Profile page makes 4 serial round-trips

**File:** `src/lib/data/profiles.ts` (around line 563)

**Problem:** Four independent queries run sequentially. Each waits for the previous to complete.

**Fix:** Wrap the three independent queries in `Promise.all`:
```ts
const [profile, activities, connections, eventsAttended] = await Promise.all([
  getProfileCore(id),
  getProfileActivities(id),
  getProfileConnections(id),
  getProfileEvents(id),
]);
```

---

### 🔧 #18 — Search enrich calls are serial

**File:** `src/lib/computed/search.ts` (around line 136)

**Problem:** 5 sequential enrich calls after the FTS fan-out. All are independent.

**Fix:** `await Promise.all(results.map(r => enrichSearchResult(r)))`.

---

### 🔧 #19 — Sequential UPDATE per import row (up to 1,000 rows)

**File:** `src/lib/data/imports.ts` (around line 544)

**Problem:** A `for` loop runs one `UPDATE` per import row. 1,000 rows = ~5 seconds of serial I/O.

**Fix:** Batch upsert using `supabase.from(...).upsert(rows)` with the full array, or use `runConcurrent` with a concurrency limit of 10.

---

### 🔧 #20 — `activitiesCreated` return value discarded in actions.ts

**File:** `src/lib/integrations/calendar/actions.ts` (around line 65)

**Problem:** `backfillCalendarReviewsForProfile` returns an activities-created count but the call site discards it. The `activitiesCreated` field in the response comes from the review count instead.

**Fix:** Capture and use the return value:
```ts
const { activitiesCreated } = await backfillCalendarReviewsForProfile(...);
return { activitiesCreated, ... };
```

---

### 🔧 #27 — Missing `pg_trgm` GIN indexes for ILIKE searches

**File:** Add to the same migration as #16

**Problem:** All `ILIKE '%query%'` searches on `full_name` and `organisation_name` do full table scans. With 314 profiles this is tolerable; with 1,000+ it becomes slow.

**Add to the perf indexes migration:**
```sql
-- Enable pg_trgm if not already enabled (idempotent)
create extension if not exists pg_trgm;

-- GIN trigram indexes for ILIKE search
create index if not exists profiles_full_name_trgm_idx
  on profiles using gin (full_name gin_trgm_ops);

create index if not exists profiles_org_name_trgm_idx
  on profiles using gin (organisation_name gin_trgm_ops);
```

---

## Low — address when convenient

### 🔧 #14 — No per-request timeout on Google Calendar API calls

Add a `timeout` option to the calendar client config:
```ts
// In getCalendarClient() or the events.list call
timeout: 30_000, // 30 seconds per request
```

### 🔧 #22/#23 — ARIA issues in search dropdowns and table rows

- `add-connection-form.tsx` and `add-event-attendee-form.tsx`: search dropdowns missing `role="combobox"`, `aria-expanded`, `aria-controls` on the input, and `role="listbox"` + `role="option"` on the results.
- `profiles-table.tsx` and `events-table.tsx`: `role="link"` on `<tr>` is invalid — use `role="button"`.

### 🔧 #24 — `defaultDateTimeLocalValue()` called inline without `useMemo`

**File:** `src/components/events/create-event-form.tsx` (line 155)

Wrap in `useMemo(() => defaultDateTimeLocalValue(), [])` to prevent the date field resetting on every render while the panel is open.

### 🔧 #26 — `app-sidebar.tsx` `aria-disabled` no-op on `<span>`

Replace `<span aria-disabled="true">` with `<button disabled>` or an `<a>` with `aria-disabled="true"` + `onClick={e => e.preventDefault()}`.

### 🔧 #28 — `getUserRow` uses `SELECT *`

**File:** `src/lib/auth/session.ts`

Change to `select("id, org_id, email, full_name, role")` — runs on every authenticated request.

### 🔧 #29/#30 — Async/debounce cleanup on unmount

- `calendar-sync-review-wizard.tsx`: add abort controller to cancel in-flight search on unmount.
- `add-connection-form.tsx` and `add-event-attendee-form.tsx`: cancel debounce timers in `useEffect` cleanup return.

### 🔧 #31 — Sidebar Suspense causes 240px layout shift

**File:** `src/app/(app)/layout.tsx`

The entire sidebar is in `<Suspense fallback={null}>` — this causes a 240px-wide layout shift on initial paint because the sidebar renders as nothing, then jumps in. Only the part that needs client data (`useSearchParams` for the active state) needs to be in a client island. Extract just that small piece into a `<SidebarActiveState>` client component, and render the full sidebar structure statically.

### 🔧 #32 — Drawer backdrop missing `aria-hidden`

**File:** `src/components/profiles/profile-drawer.tsx`

Add `aria-hidden="true"` to the backdrop overlay element.

---

## Session checklist

- [ ] #1 — Backfill moved out of `after()` hook
- [ ] #2 — N+1 in match.ts: pre-fetch org profiles into Map
- [ ] #5 — Per-worker accumulators in import workers
- [ ] #6 — Cron returns 200 for partial success, 500 only for total failure
- [ ] #8 — `listProfiles()` pagination + `listProfileIds()`
- [ ] #9 — `recency.ts` DISTINCT ON RPC
- [ ] #10 — Remove redundant `connectionExists()` pre-check
- [ ] #12 — GaxiosError status check for 410
- [ ] #13 — 429 rate-limit early exit
- [ ] #15 — Cache derived key in `crypto.ts`
- [ ] #16/#27 — New migration with missing indexes + pg_trgm
- [ ] #17 — Profile page queries parallelised
- [ ] #18 — Search enrich calls parallelised
- [ ] #19 — Import batch upsert
- [ ] #20 — `activitiesCreated` return value used
- [ ] Low items as time allows
