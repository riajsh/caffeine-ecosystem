# Someday List

Things we know about but aren't acting on yet. Nothing here needs action right now — it's here so we don't forget it, and so we remember *why* it's waiting.

---

## Before this goes live (not urgent — we're not live yet)

- **Move Vercel and Google OAuth from Chris to Ria.** Still outstanding. Full checklist is in `docs/handover-caffeine.md`. Ria's call on timing — not urgent while we focus on features that don't need this first.
- ~~Move Supabase to Ria's own account~~ — **Resolved 2026-08-13, no action needed.** The Supabase project lives under Previously Unavailable's Pro account (the parent company that owns Caffeine Daily), not Chris's personal account. Ria already has access via `rs@previously.co`, so there's nothing to migrate.

## Worth a closer look together, when we're ready

- **Old engineering audit doc.** There's a file at `docs/cursor-brief-audit-fixes.md` listing about 30 issues Chris's team found in a code review (things like slow queries, a couple of small correctness bugs, some accessibility gaps). Spot-checking a few, it looks like several have already been quietly fixed by later work — but the doc was never updated to reflect that. Worth a session together to go through it, cross off what's already handled, and move any real remaining issues onto this list one at a time so they're easy to action.
- **Gmail sync.** The database is already set up for it, but the actual email-syncing feature hasn't been built (see `docs/specs/gmail-sync.md`). Only relevant once you want email history sitting alongside calendar meetings on a profile.
