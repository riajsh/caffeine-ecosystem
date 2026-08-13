# Someday List

Things we know about but aren't acting on yet. Nothing here needs action right now — it's here so we don't forget it, and so we remember *why* it's waiting.

---

## Before this goes live (not urgent — we're not live yet)

- **Move hosting accounts from Chris to Ria.** Supabase, Vercel, and Google OAuth are still on Chris's accounts. Full checklist is in `docs/handover-caffeine.md`. Ria's call on timing — parked as of 2026-07-06 while we focus on features that don't need this move first. Revisited 2026-08-13: Chris is still an easily reachable colleague, so no urgency — either a quick "add Ria as Owner" on the existing Supabase project, or the full move to a fresh project, can happen whenever it's actually needed (before go-live, or sooner if Chris ever becomes unreachable).

## Worth a closer look together, when we're ready

- **Old engineering audit doc.** There's a file at `docs/cursor-brief-audit-fixes.md` listing about 30 issues Chris's team found in a code review (things like slow queries, a couple of small correctness bugs, some accessibility gaps). Spot-checking a few, it looks like several have already been quietly fixed by later work — but the doc was never updated to reflect that. Worth a session together to go through it, cross off what's already handled, and move any real remaining issues onto this list one at a time so they're easy to action.
- **Gmail sync.** The database is already set up for it, but the actual email-syncing feature hasn't been built (see `docs/specs/gmail-sync.md`). Only relevant once you want email history sitting alongside calendar meetings on a profile.
