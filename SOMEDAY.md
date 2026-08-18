# Someday List

Things we know about but aren't acting on yet. Nothing here needs action right now — it's here so we don't forget it, and so we remember *why* it's waiting.

---

## Before this goes live (not urgent — we're not live yet)

- ~~Move Vercel from Chris to Ria~~ — **Resolved 2026-08-19.** Live on a brand new, Caffeine-only Vercel Pro project under `hello@caffeinedaily.co`, at `https://caffeine-ecosystem-two.vercel.app`.
- ~~Set up Google OAuth for sign-in~~ — **Resolved 2026-08-19.** New Google Cloud project ("Caffeine Daily," under `hello@caffeinedaily.co`) with a working sign-in client, connected to Supabase. **Still outstanding:** Calendar API access (a separate OAuth client/scope) hasn't been set up yet — Calendar connect/sync won't work live until that's done, likely reusing this same Google Cloud project.
- ~~Move Supabase to Ria's own account~~ — **Resolved 2026-08-13, no action needed.** The Supabase project lives under Previously Unavailable's Pro account (the parent company that owns Caffeine Daily), not Chris's personal account. Ria already has access via `rs@previously.co`, so there's nothing to migrate.

## Worth a closer look together, when we're ready

- **Old engineering audit doc.** There's a file at `docs/cursor-brief-audit-fixes.md` listing about 30 issues Chris's team found in a code review (things like slow queries, a couple of small correctness bugs, some accessibility gaps). Spot-checking a few, it looks like several have already been quietly fixed by later work — but the doc was never updated to reflect that. Worth a session together to go through it, cross off what's already handled, and move any real remaining issues onto this list one at a time so they're easy to action.
- **Gmail sync.** The database is already set up for it, but the actual email-syncing feature hasn't been built (see `docs/specs/gmail-sync.md`). Only relevant once you want email history sitting alongside calendar meetings on a profile.
- **Eventbrite sync.** Scoped out 2026-08-17 (see `docs/decisions/0011-eventbrite-sync.md` and `docs/specs/eventbrite-sync.md`). Phase 1 (connect screen) built 2026-08-17 — Admin now has a place to paste and validate your private token. Phases 2-3 (pick which Eventbrite event maps to which Caffeine event, then actually pull attendees on a schedule) are not started. Next step once you've tried connecting: confirm it works reliably, then decide whether to move on to event mapping.
