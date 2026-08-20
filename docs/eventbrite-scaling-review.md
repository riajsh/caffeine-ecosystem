# Eventbrite workflow review — scaling to 40+ events

- Date: 2026-08-20
- Why: Ria is about to link, sync, and review all ~40+ of Caffeine's existing Eventbrite events. This is a review of the current system to find gaps before that happens, not a build — nothing here has been built yet.

---

## 1. What's already solid

Worth saying plainly, since the rest of this is mostly "here's what could bite you":

- Matching by email, tagging, and attendee tracking all work and are duplicate-safe — confirmed multiple times this week (races, re-syncs, bulk actions all reuse existing profiles rather than creating copies).
- A single event's sync failing doesn't take down the others — the sync loop catches errors per event and keeps going.
- The review queue (unmatched attendees + possible profile updates) is a good safety net — nothing gets auto-created or silently overwritten without a human seeing it.
- Linking now pulls attendees in immediately (just fixed) — no more waiting on the cron.

## 2. Where this will hurt at 40+ events

### 2.1 Sync failures are invisible once nobody's watching

The background sync (every 30 minutes) records `last_sync_at` and any errors from its last run in the database — but nothing in the Admin screen actually shows this. The only place you ever see sync results is a toast that appears for a few seconds right when you personally click "Sync now." The automatic cron runs show you nothing at all.

Worse: if your Eventbrite token ever gets revoked or expires, every single sync — for every one of the 40+ events — would start failing silently. You wouldn't find out until you noticed new attendees had quietly stopped appearing, which could be days.

**This is the highest-priority gap.** At 5 events you'd probably notice something felt off. At 40+, running unattended, you need the system to tell you when something's wrong rather than relying on you checking.

### 2.2 Mapping registration questions is fully manual, per event

You mentioned each event's questions will be "more or less the same." Right now, mapping them (which question → Role / Company size / Phone) has to be done from scratch on every single event, one at a time, with zero memory of what you chose last time. Across 40+ events that's 40+ repetitions of a decision that's probably identical or near-identical each time.

### 2.3 The review screen has no way to filter, search, or group by event

Right now "Eventbrite review" is one flat list — every unmatched attendee and every possible profile update, from every event, all mixed together in one feed. That's fine at the scale you've been testing with. Once 40+ events are all feeding into the same queue, especially around a busy week with several events close together, this list could get long and hard to scan — no way to say "just show me people from Thursday's event."

### 2.4 Linking is one-at-a-time with no shortcuts

Each event has to be opened, matched against a dropdown of existing Caffeine events (or told to create a new one), and confirmed — individually, for all 40+. This is a one-time decision per event (not a recurring pain like the two above), so it's lower priority, but still 40 repetitive clicks with no bulk option or smart suggestions.

### 2.5 A couple of smaller rough edges

- The review queue only ever loads the most recent 200 pending items — not a problem yet, but worth knowing the ceiling exists if a big backlog ever builds up.
- There's no simple way to see, at a glance, "which of my 40 events are actually linked and syncing correctly" vs. "which ones I haven't gotten to yet" — the events list shows link status per row, but there's no summary/count anywhere (e.g. "32 of 40 linked, 3 with sync errors").

---

## 3. Recommended order

**Now — before you start the 40-event rollout:**

1. **Surface sync health in Admin.** Show "last synced: X ago" plus any errors from the last run, right on the Eventbrite card you already see on the Admin overview page. This turns "silently broken" into "impossible to miss." Small effort — the data's already being recorded, it just needs a place to show up.
2. **Detect and flag an invalid/revoked token clearly**, instead of it just quietly erroring on every event forever. Small–medium effort.

**Soon — will save real time across 40 events, but not a blocker to starting:**

3. **Let a question mapping be copied from a previous event** as a starting point, so mapping is "confirm this looks right" instead of "build from scratch" for events with similar question sets. Medium effort.
4. **Group or filter the review screen by event**, so a long list stays manageable once several events are active at once. Medium effort.

**Later — nice to have, not urgent:**

5. A summary count on the events list ("32 of 40 linked, 3 need attention").
6. Smarter bulk-linking suggestions (matching by name/date) — riskier to get right (false matches), so lower priority unless the one-at-a-time linking genuinely becomes a bottleneck.

---

## 4. What I'd suggest

Tackle 1 and 2 first — they're both about not finding out something broke three weeks late, which matters more once this is running mostly unattended across 40+ events. Then 3 and 4 will make the actual day-to-day work of linking and reviewing noticeably less repetitive.

Happy to just start working through this list in order, or you can tell me to prioritize differently.
