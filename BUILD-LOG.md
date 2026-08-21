# Build Log

A plain-language, dated history of what Ria and Claude have built, fixed, or changed together. Newest entries at the top.

---

## 2026-08-21 (36)

**Fixed: one profile still failed to create with the same duplicate-note error**

- **What was wrong:** the previous fix stopped notes from colliding with "attended this event" records, but missed one case — if two different Eventbrite registrations share the same email for the same event (a duplicate signup), both get resolved against the same profile, and both were trying to add that profile's one note for that event.
- **What changed:** adding a note now treats "this profile already has this event's note" as fine and moves on, rather than failing — whichever registration gets there first wins, the second is just a no-op instead of an error.
- **Nothing to run in Supabase for this one.**
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean.

## 2026-08-21 (35)

**Fixed: re-syncing an already-synced event failed with "duplicate key value violates unique constraint" on notes**

- **What was wrong:** the database only allows one activity record per profile per event per "source" — it doesn't care about the difference between an "Attended this event" record and a "Note from this event" record if they're tagged the same way underneath. My note feature was tagging both the same way, so the very first re-sync of an event that already had attendance recorded failed trying to add the note.
- **What changed:** notes now get their own distinct tag underneath (still tied to the same event, still only ever added once), so they sit alongside the "attended" record instead of colliding with it.
- **Nothing to run in Supabase for this one** — pure app-side fix.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean.

## 2026-08-21 (34)

**Added: a "Note" question mapping that writes straight into a profile's timeline**

- **What it does:** you can now map an open-ended registration question (like "what are you struggling with right now?") to "Note" instead of a profile field. Whichever attendee answers it gets a new dated entry in their profile's existing activity timeline — the same timeline manual notes, meetings, and intros already show up in — tagged with the event name and dated to the event.
- **How it behaves:** each event only ever adds one note per person, even if you sync the same event again later. If the same person answers a similar question at a different event, that's a separate dated entry, not a merge into the first one — so you build up a real history over time rather than losing earlier answers.
- **Where it doesn't show up:** unlike Role/Company, note answers aren't previewed as an editable box on the review screen — they're written once the review turns into (or links to) a profile, kept out of that already-busy row to keep it simple. Let me know if you'd rather see a preview there too.
- **To run in Supabase:** one migration widening the allowed mapping values to include "note" — see file below.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 pre-existing warnings).

## 2026-08-20 (33)

**Fixed: "Sync now" being slow — actually fixed this time, not just worked around**

- **What was actually wrong:** every sync (the cron, "Sync now", and now the new per-event button) was doing a handful of separate database checks for every single attendee, one at a time — "does this person already have a profile match", "are they already recorded as an attendee", "do we already have evidence they attended", "are they already tagged". For an event with a few hundred attendees, that's hundreds of tiny back-and-forths, one after another, before it can even start writing anything. That's what made it feel like it hung for minutes, and why it was only going to get worse as you link more of your 40+ events.
- **What changed:** for each event, the sync now asks those same questions once, in bulk, for everyone at once — then only writes the handful of things that actually changed. Nothing about what it does or how it decides things is different (it still never re-creates something that already exists, never overwrites a changed role/company without asking you first, still queues the same reviews) — it just does the same work in a handful of trips instead of hundreds.
- **Nothing to run in Supabase for this one** — this is all in how the app talks to the database, not the database itself.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 pre-existing warnings). I re-read through the whole rewritten flow line by line against the old version to make sure the actual behaviour (what gets created, what gets skipped, what gets flagged for your review) is identical — only the number of trips to the database changed.

## 2026-08-20 (32)

**Added: a "Sync this event" button on each linked event**

- **Why:** the only "Sync now" button on the main Admin page re-syncs every single Eventbrite event you've ever linked, not just the one you're working on — so testing a change to one event (like a new question mapping) meant waiting on a full resync of everything. This adds a fast, one-event version next to each linked event's question mapping.
- **Nothing to run in Supabase for this one.**
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean.

## 2026-08-20 (31)

**Added: a standalone "Company" question mapping**

- **What it does:** when mapping an event's registration questions, there's now a "Company" option alongside "Role" — for events that ask company name as its own separate question (not combined with role). An answer mapped this way fills the profile's Company field directly, same as Role already does.
- **How it's different from "Company & role (combined)":** that option is still there for when one question asks for both together and needs splitting. Use "Company" instead when the form already asks for company name on its own.
- **To run in Supabase:** one migration, widening the allowed mapping values to include "company" — see file below.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 pre-existing warnings).

## 2026-08-20 (30)

**Fixed: a still-pending review's suggested Role/Company never refreshed after changing the question mapping**

- **What was wrong:** if an attendee was still sitting in the review queue (not yet turned into a profile) when you added a "Company & role" mapping afterwards, re-syncing wouldn't update that review's pre-filled suggestion — it kept whatever it had (nothing) from before the mapping existed.
- **What we changed:** a re-sync now refreshes the suggested answers on any review that's still pending, so mapping changes show up there too. Anything already turned into a profile is never touched by this.
- **Nothing to run in Supabase for this one.**
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean.

## 2026-08-20 (29)

**Built: split a combined "company & role" registration question into two profile fields**

- **What was wrong:** Some events (confirmed from a real Eventbrite export you shared — "Caffeine x Airwallex Friend") ask one question like "What's your company & role?" instead of two separate ones. Answers came through in every format imaginable — "Lumin, VP of Growth", "CSO - Pyper Vision", "Chief Marketing Officer at LawVu" — with no consistent order or separator, so there was no way to map it to just one field without losing the other half.
- **What we built:** A new mapping option, "Company & role (combined)", on the question-mapping screen. Pick it for a question like this and each attendee's answer gets automatically split into Role and Company — reads the actual sentence rather than just splitting on a comma, since the format varies too much for a fixed rule (a small number of genuinely ambiguous ones, like someone listing three different roles at once, get left for a human rather than guessed at wrong).
- **Also added, as you asked:** Role and Company now show up as editable fields on the attendee review screen too, right alongside Name and Email — pre-filled with the best guess, but you can fix them before creating a profile, exactly like the existing name/email editing.
- **For attendees who already have a profile:** works the same safe way as role/company size already do — fills in the field if it's blank, and queues it as a "possible update" for you to approve if it's already set to something different.
- **Accuracy note:** this genuinely needs an AI model to do well — reading "Pyper Vision - Chair, Victory and Grace - Co-Founder, Chitogel - Director" and knowing which is which isn't something a fixed rule can do reliably. Without an `ANTHROPIC_API_KEY` configured, it falls back to a simpler guess that handles clean two-part answers fine but bails out (leaving the whole answer in Role, Company blank) on messier ones — which is exactly why the new editable review fields matter.
- **What you need to do:** run the migration below in Supabase SQL Editor (just widens what a question mapping is allowed to be set to — no data changes).
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (28)

**Built: the four "before the 40+ event rollout" fixes from the workflow review**

Following the review at `docs/eventbrite-scaling-review.md`, built the top four items in priority order:

- **Sync health is now visible.** The Eventbrite card on Admin now shows "Last synced X ago" (or "Disconnected", or a count of issues from the last run) instead of only ever showing up as a toast the moment you personally click "Sync now." The background cron's results are now just as visible as a manual sync.
- **A revoked/expired token is detected and flagged.** If Eventbrite ever rejects the connection (401/403), sync now stops immediately, switches itself off, and shows a clear "Your Eventbrite connection stopped working — reconnect below" message with the reconnect form right there — instead of quietly failing on every one of the 40+ events forever with no visible sign anything was wrong.
- **Question mappings can now be reused.** Opening "Map registration questions" on an event that hasn't been mapped yet will suggest field choices carried over from a previous event that asked the same question (matched by question text), marked "(suggested)" — check it looks right and save to confirm, instead of mapping every event completely from scratch.
- **The review screen is now grouped by event, with a filter.** Unmatched attendees are grouped under their event (with a "select all" / bulk create-or-ignore scoped to just that event's group), and a filter box at the top narrows everything — attendee reviews and possible profile updates both — down to one event or person by name.
- **Nothing to run in Supabase for any of this** — all application-level changes, no schema changes.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings) after each of the four changes.

**Still on the list (lower priority, not built yet):** a summary count of "X of 40 linked" on the events screen, and smarter bulk-linking suggestions. See the review doc for detail — happy to pick these up too if useful.

## 2026-08-20 (27)

**Fixed: linking a new event didn't pull attendees in until the next automatic sync**

- **What was wrong:** Linking (or creating) an event on the "Link events" screen only recorded which Eventbrite event it matches — it never actually pulled attendees in right then. They'd only show up once the background sync next ran (every 30 minutes for events happening soon), or if you clicked "Sync now" yourself. That gap made it look like linking had silently failed to do anything.
- **What we changed:** Linking an event now immediately pulls in its attendees as part of the same action — no more waiting. The confirmation message now tells you what happened (e.g. "Event linked — 12 attendees added, 3 queued for review").
- **If linking still shows "no attendees yet":** that likely means Eventbrite itself doesn't have any real registrations on that event yet, rather than anything broken — worth double-checking the event on Eventbrite's own site if that happens somewhere you expect people.
- **Nothing to run in Supabase for this one** — purely a code/logic change.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (26)

**Fixed: Eventbrite's "Info Requested" placeholder attendees were flooding the review queue**

- **What was wrong:** On a group ticket (one person buying several tickets at once), Eventbrite doesn't have real details for the other attendees until they each fill in their own registration — until then it shows a literal placeholder name/email of "Info Requested" / "info requested". The sync was treating that placeholder like a real (if oddly-named) attendee and queuing it for review, so a single group booking could flood the queue with dozens of identical, meaningless "Info Requested Info Requested" rows. These are not duplicate tickets for one real person — each row is a distinct ticket/attendee slot on the order, they've just genuinely got no info attached yet.
- **What we changed:** The sync now recognises this placeholder (and anything else that isn't a real email) and skips those attendees entirely — same as if Eventbrite hadn't given us an email at all. If the real person later fills in their details, a normal sync will pick them up properly at that point.
- **Also added:** an "Ignore N selected" button next to "Create N new profiles" on the review screen, for exactly this kind of cleanup — tick a batch, ignore them all at once, same progress bar as bulk-create.
- **What you need to do:** run the migration below in Supabase SQL Editor to clear out the "Info Requested" rows already sitting in your queue from before this fix (nothing else is touched).
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (25)

**Fixed: bulk "create profiles" got stuck on 79 attendees and only made it through 69**

- **What was wrong:** The bulk create button did all selected attendees in one single request. With a large batch (79 in this case), that request ran long enough to hit the website hosting's own time limit for a single request and got killed silently partway through — it had already created most of the profiles by then, but the button never got a response back, so it stayed stuck on "Creating…" forever with no way to tell what had or hadn't gone through.
- **What we changed:** It now works through selected attendees in small batches (10 at a time) instead of all at once, with a live progress bar showing "Creating X of Y…" and a percentage. Each batch is small enough to comfortably finish well within any time limit, so it can't silently die partway through again. If a batch does hit a hiccup, it retries once before giving up on just that batch (everything else keeps going).
- **On repeating the upload:** this wasn't actually re-uploading — each attendee's record already remembers whether it's been resolved, so anyone already turned into a profile just disappears from the list. Selecting "all" again only affects whoever's still pending; nothing gets duplicated. The confusing part was just the lack of visible progress, which the fix above addresses directly.
- **Nothing to run in Supabase for this one** — purely a UI/logic fix.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (24)

**Added: select-all + bulk "create profiles" on Eventbrite review, and merged the review + updates screens into one**

- **Bulk create:** the Eventbrite review screen (unmatched attendees) now has a "Select all" checkbox and a checkbox on each row. Fix up any names/emails you need to individually first, tick the ones that are ready, then one "Create N new profiles" button creates them all at once instead of one at a time.
- **Duplicate-safe:** if two selected rows turn out to share the same email (e.g. someone registered twice for the same event), the second one automatically finds the profile the first one just created and reuses it — you won't end up with two profiles for the same person either way.
- **Merged screens:** "Eventbrite review" and "Eventbrite updates" are now one screen — unmatched attendees on top, possible profile updates at the bottom — instead of two separate tabs. The Admin overview now has a single "Review" button with a combined count. The old "Eventbrite updates" link still works, it just forwards here now.
- **Nothing to run in Supabase for this one** — purely a UI change, no database update needed.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (23)

**Built: Eventbrite registration answers now fill in role, phone, and company size on profiles**

- **What we built:** On the "Eventbrite events" screen, each linked event now has a "Map registration questions" option — a one-time, per-event choice of which of the event's sign-up questions correspond to Role, Company size, or Phone (or "Don't use"). Once mapped, every attendee's answers to those questions flow into their profile automatically on sync.
- **Formatting fixes:** Free-text answers (mainly job titles) are automatically cleaned up — proper capitalisation, genuine spelling mistakes fixed, real acronyms like CEO/VP/HR kept as-is — instead of coming through as all-lowercase, ALL CAPS, or jumbled. This uses an AI model when available (needs an `ANTHROPIC_API_KEY` — see below), and falls back to a simpler capitalisation-only fix if that's not configured, so it never blocks a sync either way.
- **Filling in existing profiles safely:** if someone's profile already has a blank role/phone/company size, the new answer fills it in automatically. If the profile already has something different there (a role or company change, say), it does **not** get overwritten — instead it's queued on a new "Possible updates" screen (Admin → Eventbrite updates) for a human to look at and approve or dismiss. This also happens for anyone still sitting in the regular attendee review queue — once you link or create their profile, their answers get applied then.
- **Why it matters:** this is what makes the searchable database actually useful — role, company size, and location now get populated consistently from event sign-ups, so a search like "Senior marketing executives in early-stage start-ups" has real data behind it. And since Caffeine Daily is the pulse on the community, a "possible update" flag means a promotion or company change doesn't slip through unnoticed.
- **What you need to do:**
  1. Run the migration below in Supabase SQL Editor (adds `company_size` to profiles, widens search to include it, and adds the two new tables behind this).
  2. Push the code (commands below).
  3. If you want the smart spelling/formatting cleanup to actually use AI (rather than just the basic capitalisation fallback), you'll need an Anthropic API key added as `ANTHROPIC_API_KEY` — happy to walk you through getting one whenever you're ready; everything works fine without it in the meantime.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (22)

**Fixed: garbled "b'Name'" attendee names from Eventbrite + can now edit names/emails in review**

- **What was wrong:** Some Eventbrite attendee names in the review queue showed up like `b'Eva' b'Kulkarni'` instead of `Eva Kulkarni`. This is a genuine data bug on Eventbrite's side — likely fallout from their rocky 2026 ownership change — where raw computer data ("bytes") got printed as text instead of being converted properly, and it's baked into what their API sends us.
- **What we changed:** The app now automatically strips that `b'...'` wrapper from names and ticket types every time it syncs, so this won't happen again going forward. Also ran a one-time cleanup (migration below) to fix the names already sitting in the review queue from before this fix.
- **Also added:** you can now edit the name and email before creating a new profile from a review — handy for fixing anything Eventbrite gets wrong, or just correcting a typo, without needing to fix it later on the profile itself.
- **What you need to do:** run the migration below in Supabase SQL Editor to clean up the already-affected review rows.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-20 (21)

**Fixed: "Eventbrite events" page crashed with a server error**

- **What was wrong:** Eventbrite accounts that belong to a shared team "Organization" (like Caffeine Daily's) don't list their events the same way a personal account does — the events live under the Organization, not the personal user. We were only ever checking the personal-user path, so the page had nothing to show and crashed instead of handling it gracefully.
- **What we changed:** Now checks for a connected Organization first and lists its events from there, falling back to the personal path only if there isn't one. Also made the page fail gracefully with a clear on-screen message instead of a blank server error, so if something like this happens again it's easy to see why.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings).

## 2026-08-19 (20)

**Built: Eventbrite auto-pulls attendees, matches them, tags them, and keeps them updated (Phases 2-3 of the Eventbrite plan)**

- **Event mapping (Admin → Eventbrite events):** lists every event in your connected Eventbrite account. For each one, link it to an existing Caffeine event or create a new one — a one-time click per event, remembered from then on.
- **Automatic attendee sync:** once an event is linked, attendees get pulled in automatically — every 30 minutes for events happening soon or that just finished, once a day for everything else. There's also a "Sync now" button on the Admin page for an on-demand pull.
- **Matching and tagging:** an attendee whose email matches an existing profile gets added to the event as "Registered" and tagged with the event's name — reusing the exact same tagging logic as CSV import and the bulk "add to event" action.
- **Review queue (Admin → Eventbrite review):** an attendee whose email doesn't match anyone gets queued for a human to look at, instead of a profile being silently auto-created. From there: search and link to an existing profile, create a new one, or ignore.
- **Mark attended:** added a small "Mark attended" / "Mark registered" button to the attendees list on an event's page — since Eventbrite attendee data only tells us who registered, not who actually showed up, this lets you flip that by hand once you know (e.g. from Eventbrite's own check-in list after the event).
- **What you need to do:** run the migration below in Supabase SQL Editor before this goes live — it adds the link from Caffeine events to Eventbrite events, plus the new review-queue table.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings as before).

## 2026-08-19 (19)

**Milestone: the app is live on the real internet for the first time**

- **What we did:** Set up a brand new, Caffeine-only Vercel project (Pro plan) under `hello@caffeinedaily.co` — separate from the parent company's shared Vercel/GitHub team, so this doesn't get tangled up with other projects. Connected it to the `riajsh/caffeine-ecosystem` GitHub repo, added all the environment variables, and deployed. The site is now live at `https://caffeine-ecosystem-two.vercel.app`.
- **Also set up: Google sign-in.** Created a brand new Google Cloud project ("Caffeine Daily," under `hello@caffeinedaily.co`) and an OAuth client so people can actually sign in with their `@caffeinedaily.co` Google account on the live site — this had never been configured before, only the local dev password shortcut had been tested. Connected it to Supabase's sign-in settings.
- **Note:** this new Google Cloud project only covers sign-in for now. It does **not** yet include Calendar API access — `GOOGLE_CALENDAR_CLIENT_ID`/`SECRET` are still blank, so Calendar connect/sync won't work on the live site until that's set up separately (same project can likely be reused for that later).
- **Cron schedule:** calendar sync's scheduled job is back to running hourly (it was temporarily set to once-daily to fit the free Hobby plan's limits, but Pro removes that restriction).
- **This closes out two long-standing items from the handover checklist:** "Vercel project" and (partially) "Google Cloud OAuth" — both had been sitting as outstanding since the handover from Chris.

## 2026-08-17 (18)

**Built: Eventbrite connect screen (Phase 1 of the Eventbrite plan)**

- **What we built:** A new "Eventbrite" section in Admin where you paste your private Eventbrite token once. We check it against Eventbrite immediately (so a typo or bad token is caught right away), then store it encrypted the same way your Google Calendar connection is stored. Once connected, it shows the account name/email and a Disconnect button.
- **What this doesn't do yet:** This is just the connection — no attendee lists are pulled in yet. That's Phases 2 and 3 from `docs/specs/eventbrite-sync.md` (picking which Eventbrite event maps to which Caffeine event, then actually pulling attendees on a schedule). Recommended next step per that plan: confirm this connects cleanly and reliably before building further.
- **What you need to do:** Run the migration below in Supabase SQL Editor, then paste your private token into the new Eventbrite section on the Admin page once the code is deployed.
- **Checked:** `npx tsc --noEmit` and `npx eslint src` both clean (0 errors, same 5 unrelated pre-existing warnings as before).

## 2026-08-17 (17)

**Scoped out (not built): an Eventbrite integration**

- **What we did:** Ria asked whether Eventbrite could plug in directly instead of exporting attendee lists as a CSV. Researched Eventbrite's current API, wrote up a full plan mirroring the same pattern already proven for Google Calendar sync — `docs/decisions/0011-eventbrite-sync.md` (the design decision) and `docs/specs/eventbrite-sync.md` (the detailed spec).
- **Important flag:** Eventbrite's developer platform looks genuinely unstable right now (acquired by Bending Spoons in March 2026, followed by major layoffs; API support is community-only, not a real support team). Before any building starts, there's a 5-minute check to do first: confirm a private API token can actually be generated in Ria's own Eventbrite account settings. If not, this isn't worth pursuing and the existing CSV-export-then-upload flow remains the answer.
- **Nothing built yet** — this is planning only, logged on the Someday list until Ria decides to move forward.

## 2026-08-17 (16)

**Fixed: renaming an event didn't update the event tag on already-tagged profiles**

- **What was wrong:** Attendees get tagged with the event's name at the moment they're tagged (during an event-attached upload, or the bulk "add to event" action) — but that tag is just a plain label with that name, not a live link back to the event. So when the event was later renamed, everyone already tagged still showed the old name.
- **What we changed:** Renaming an event now also renames its attendees' tag to match, so everyone stays showing the current name. If the new name happens to collide with an existing tag (rare), we merge into it rather than erroring.
- **For the event you already renamed:** this fix only applies going forward — the tag from before the fix won't retroactively update itself. To fix that one: edit the event, save it as something slightly different, then edit it again back to the correct name. Each save now correctly renames the tag, so two saves gets it to the right place.

## 2026-08-17 (15)

**Added: you can now edit an event after it's created**

- **What we built:** An "Edit event" button on the event's page lets you change the title, type, date, location, and description at any time — not just when first creating it. Same fields as the "New event" form, just pre-filled with what's already there.
- **Why it matters:** Event details aren't always right the first time (wrong date, typo in the name, added a location later) — now that's a quick fix instead of deleting and recreating the whole event (which would have lost all its attendees).

## 2026-08-17 (14)

**Reworked: "Complete" no longer runs as one giant request**

- **What was wrong:** Completing an import ran as a single, continuous request from start to finish. For a bigger file, that one request could run for minutes — which risked the hosting platform cutting it off outright, and tied up a chunk of the database's limited connections for the whole time, which is very likely why the rest of the app went sluggish at the same moment. At 2,000 profiles, this would have very likely failed outright rather than just being slow.
- **What we changed:** "Complete" now runs the same way "Load past meetings" already does — in small, quick bursts (about 48 people each) that the browser automatically re-requests one after another until the whole file is done, instead of one long call. Each burst finishes in a few seconds, so there's no single request long enough to time out or hog the database. If you close the tab or it gets interrupted partway, reopening the import picks it back up automatically — no manual "Resume" click needed (though the button's still there as a backup).
- **Checked this works:** ran the exact logic through test files of 40, 150, 400, and 2,000 rows — every case broke into a clean series of short bursts (2,000 rows = 42 quick bursts, none processing more than 48 rows at a time).
- **Why it matters:** this should fix the freezing you saw, and makes a 2,000-row upload something the platform can actually handle reliably, not just "hopefully fast enough."

## 2026-08-17 (13)

**Fixed: "Complete" looked frozen, and Cancel didn't actually stop it**

- **What was wrong:** The system only checked in on a running "Complete" every 150 people — useful for genuinely huge files, but most of your uploads are well under 150 people, so that check-in never happened at all. In practice this meant: the new progress bar stayed at 0% the entire time (looking exactly like a freeze), and clicking Cancel had no effect until the very end, because the running import never paused to notice it had been cancelled — it just kept going and finished anyway.
- **What we changed:** That check-in (saving progress, and noticing if you've hit Cancel) now happens every 6 people instead of every 150. For a typical list, you'll now see the progress bar move in real time, and Cancel will actually take effect within a few seconds instead of being ignored.
- **Why it matters:** This was the real cause behind both "it looks frozen" and "cancel didn't work, it uploaded anyway."

## 2026-08-17 (12)

**Fixed: a failed "Complete" could leave behind profiles that cancel/rollback couldn't find**

- **What was wrong:** Last week's speed-up (creating profiles 6 at a time) had a gap — if one of those 6 failed partway through, the system's "list of things to undo" never got told about the other 5 that had already succeeded. So when the automatic rollback ran (or you clicked Cancel afterward), it correctly undid what it knew about, but silently missed anyone created in the same group of 6 as the one that failed.
- **What we changed:** Every profile created is now logged the instant it happens, not after its whole group of 6 finishes — so nothing in a partially-failed group can go untracked anymore. We also made the specific error you hit (two people racing to use the same email) non-fatal: the second one is now just skipped, like any other duplicate, instead of failing the whole import.
- **Still worth checking:** any profiles left behind by the failed run you had *before* this fix won't be automatically cleaned up — worth a quick look at Profiles for that upload's people and removing obvious duplicates if you spot any (deleting should work normally now).

## 2026-08-17 (11)

**Added: a real progress bar on the "Complete" step**

- **What we built:** While an import is completing (or resuming after being interrupted), you'll now see an actual progress bar with "X of Y profiles processed" underneath, updating every couple of seconds — not just a spinner and a "this might take a minute" note.
- **Note:** the very first "Uploading & checking…" step (right after choosing your file) doesn't have this yet — it happens in one go rather than in trackable steps, so there's no real percentage to show for that part yet. That part is normally quick.

## 2026-08-17 (10)

**Fixed: "Complete" could fail with "duplicate key value violates unique constraint" on tags**

- **What was wrong:** A side effect of last week's speed-up (creating profiles 6 at a time instead of one at a time) — if several of those 6 people needed the *same* tag at the same moment (most commonly: everyone in an event-attached upload getting tagged with that event's name), two of them could both try to create that tag at the exact same instant. The database only allows one, so the second one failed and took the whole "Complete" step down with it.
- **What we changed:** If that happens now, the row that lost the race just reuses the tag the other one created, instead of throwing an error. Same fix applied to the new "add to event + tag" action on the event page, in case two people try to tag the same event at once.
- **Why it matters:** Attaching an upload to an event (which tags every single attendee with the same event name) is exactly the situation most likely to trigger this, so it should have been showing up often. Completing an import should no longer fail here.

## 2026-08-17 (9)

**Fixed: @previously.co people were still being treated as team members, again**

- **What was wrong:** We'd already narrowed the "internal team" domain to `caffeinedaily.co` so Previously Unavailable contacts wouldn't be mistaken for teammates. But the system was quietly re-widening it anyway: because James (a real team member) logs in with a `@previously.co` address, the code was pulling `previously.co` back out as an "internal domain" from his exact address — which meant every other contact at that company (Phoebe, Susie, etc.) got swept up as "internal" again, blocking deleting or merging them.
- **What we changed:** James (and any teammate's connected Gmail/Calendar account) is now recognised only by their exact address, never by treating their whole email domain as internal. Only the domain explicitly set as the team's own (`caffeinedaily.co`) grants that broader treatment.
- **Why it matters:** Anyone at Previously Unavailable is now a normal, fully-editable profile — deletable, mergeable, no special rules — while James still logs in and is still recognised as team, exactly as before. Nothing to run in Supabase for this one; it takes effect immediately since this is calculated fresh each time, not stored.

## 2026-08-17 (8)

**Moved: "connect to an event" now shows up at upload time, not just at the end**

- **What was wrong:** The only place to pick or create an event for a bulk upload was on the last "Complete" screen, several steps after choosing your file. With the faster Upload → Check & fix → Complete flow, it was easy to click through to Complete without ever noticing that box — so people got uploaded with no event connection and no obvious way to fix it without starting over.
- **What we changed:** The event picker ("Connect these people to an event") now also appears right on the initial upload screen at Profiles → Import, next to the file selector — so you choose it in the same click as picking your CSV. It's still shown again on the Complete screen too (now correctly showing "Already connected to [event]" if you set it at upload, instead of confusingly resetting to "No event"), so you can still change your mind before finishing.
- **Why it matters:** You said you won't often go back to the Events page just to re-run an upload — this puts the event connection where you'll actually see it, right when you're uploading.

## 2026-08-17 (7)

**Added: bulk-add existing profiles to an event, right from the event's page**

- **What was wrong:** The "Add attendee" box on an event's page only let you add one person at a time. If you'd already uploaded a group of people separately from an event (or wanted to attach an existing group of profiles to an event after the fact), there was no fast way to do it.
- **What we changed:** That box now lets you search and pick as many people as you like — they show up as removable chips — then one "Add N attendees" button adds them all at once. There's also an optional checkbox, "Also tag them with this event's name," so you can tag the group the same way an event-attached upload does.
- **Note on tagging:** tagging depends on a small database update (adding "Events" as an allowed tag category) that may not have been run yet on the live database. If it hasn't, attendees will still be added successfully — you'll just see a note that tagging didn't work, with no data lost.
- **Why it matters:** This covers the case Ria ran into — a fast bulk upload that didn't get event-tagged during import can now be fixed by going to the event and adding that same group of people in one action.

## 2026-08-17 (6)

**Fixed: creating brand-new profiles during "Complete" was much slower than it needed to be**

- **What was wrong:** When completing an import, rows that matched an existing profile were already being updated 6 at a time in parallel — but rows that needed a brand-new profile (the common case for a fresh event attendee list, where everyone's new) were being created one at a time, waiting for each to fully finish before starting the next.
- **What we changed:** Brand-new profiles are now created 6 at a time too, the same way updates already were. For a list of mostly new people, this should be noticeably faster — roughly 6x less waiting, since it's the same work just running in parallel instead of one-by-one.
- **Why it matters:** Bulk uploads (like event attendee lists) are almost always full of brand-new people, so this was the main thing making "Complete" feel slow.

## 2026-08-17 (5)

**Added: a way to cancel an import that's uploading or in progress**

- **What we built:** The "Delete" button on an import screen is now "Cancel import," and it's smarter than before. If nothing's been added to your profiles yet, cancelling just removes the upload. If you'd already clicked "Complete" and it's mid-way through (or got stuck partway), cancelling first undoes anything it already created or changed, then removes it — so you're never left with half-added profiles.
- **Why it matters:** Previously there was no safe way to stop an import once you'd hit Complete — you had to let it finish. Now you can back out cleanly at any point before it's fully done.

## 2026-08-17 (4)

**Rewrote a lot of engineer-speak into plain, everyday language**

- **What was wrong:** Across the app, words like "commit," "dedup," "backfill," "tier," "async," "infer/inference," "the graph," and inconsistent "org"/"workspace"/"team" were showing up in buttons, headings, and messages — fine for an engineer, confusing for anyone else.
- **What we changed:** Went through every screen and swapped these for plain words — a few examples: "Commit" → "Complete"/"Save," "Backfill" → "Load past meetings," "Dedup" → "Duplicate check," "Infer co-attendance" → "Find people who met here," "the graph" → "your network." Standardized on "team" everywhere instead of mixing "org"/"workspace"/"team." Also standardized the little "Generated"/"Suggested"/"Inferred" badges into just two meanings: "Suggested" (you can click to confirm or edit it) and "Automatic" (it's just shown to you).
- **Also softened:** two admin screens that used to show raw engineering details (environment variables, a database migration note, and an actual terminal command for adding a teammate) now say things in plain terms — e.g. "just ask Claude to add someone" instead of showing the command.
- **Why it matters:** The whole platform should read the way you'd want it to — basic, human, and easy to follow — no dictionary required.

## 2026-08-17 (3)

**Streamlined the upload process from three manual steps to Upload → Check & fix → Complete**

- **What was wrong:** Uploading a CSV meant clicking through three separate screens in order — confirm column mapping, click "Run dedup," then resolve duplicates — before you could even see whether anything was wrong with the file.
- **What we changed:** Column mapping and duplicate-checking now happen automatically the moment you upload. You land straight on a "Check & fix" screen showing a summary, anything that needs your decision (possible duplicates), and a clear list of any rows that have errors and will be skipped. A "Fix column mapping" option is tucked away and only pops open on its own if the automatic guess clearly didn't work. Then one "Complete import" button finishes the job.
- **Also added:** a fourth option for possible-duplicate rows. Alongside "merge into the existing profile," "create as new," and "skip," you can now choose "Delete & replace" — permanently deletes the existing profile and creates a fresh one from the incoming row instead. This is destructive (it asks you to confirm first) and can't be undone once the import completes successfully, though it is protected the same way manual deletes are (you can't accidentally delete a team member's profile this way).
- **Also fixed along the way:** while wiring up "Delete & replace," found and fixed a bug in the existing "merge two rows that duplicate each other within the same file" logic, where the system would sometimes fail to find the right profile to merge into during the final commit step.

## 2026-08-17 (2)

**Fixed: CSV column mapping couldn't handle separate "first name" / "last name" columns**

- **What was wrong:** The mapping dropdown only offered "Full name" as a target. If your CSV had "Attendee first name" and "Attendee last name" as two separate columns (like the BNZ list), there was no way to map them — both showed "Do not map" and the name would be lost. The helper text and error messages also only ever mentioned "Full name," which made it look like a hard requirement even after we added the fix below.
- **What we changed:** Added "First name" and "Last name" as their own options in the mapping dropdown — map both and they're combined into the profile's full name automatically (an explicit "Full name" mapping still wins if you have one). Also updated all the on-screen hints and error messages so they mention the First + Last name option too, instead of only ever saying "Full name."
- **Why it matters:** Any spreadsheet with split name columns (a very common export format) can now be imported without manually combining columns first, and the screen no longer implies you're stuck if you don't have a single "Full name" column.

## 2026-08-17

**Moved: bulk CSV import now lives under Profiles, not Admin**

- **What was wrong:** Uploading a list of profiles (like an event attendee list) took you to Admin → Datasets, which felt disconnected from Profiles — tagging, checking, and uploading didn't feel like one workflow.
- **What we changed:** The whole import screen (upload → column mapping → dedup check → soft-match review → commit, including the "attach to event" step) now lives at Profiles → Import. There's a new "Import profiles" button right on the Profiles page, and the "Import dataset" link in the empty-state now points there too.
- **What still works the same:** Only Admins can import, exactly as before — that check happens on the server regardless of which page it's on. Old `/admin/datasets` and `/admin/import` links still work; they just redirect straight to the new location so nothing breaks if a bookmark or old link is used.
- **Nothing to run in Supabase for this one** — it's purely a code/routing change, no database update needed.

## 2026-08-14

**Added: bulk-uploaded event attendee lists now properly link to the Events feature**

- **What we built:** The import screen now has an optional "Attach to an event" step. Pick an existing event or create a new one right there, and when you commit the upload, everyone in that file — new or already in the system — gets automatically linked as an attendee of that event, no separate manual step needed.
- **Also added:** a new "Events" tag category. Every profile that comes in through an event-attached upload gets tagged with the event's name automatically, so you can see (and search/filter for) everyone who's ever attended a given event, right on their profile.
- **Also fixed along the way:** a bug where any CSV "tags" column would have failed to import at all (it was trying to save tags under a category that no longer exists). Now defaults sensibly to "Expertise."
- **Still to do:** run the database update for this on the live project (see next steps in chat) before trying it for real.

## 2026-08-13

**Fixed: attendees at Previously Unavailable's own email domain were being silently treated as "team"**

- **What was wrong:** We'd set `previously.co` as an internal team domain (since James logs in with a `@previously.co` address). But Previously Unavailable is a whole company with many people — while testing an event-attendee upload, we found two real attendees (Phoebe Smith, Susie Wang) with `@previously.co` emails who would have been silently skipped as "internal," never becoming profiles.
- **What we changed:** Narrowed the internal-domain setting to just `caffeinedaily.co`. James is still recognised correctly (he's matched by his exact login, not the whole domain) — only the overly broad domain-wide assumption is gone.
- **Why it matters:** Any future contact who happens to work at Previously Unavailable will now be tracked as a real contact instead of disappearing silently.

**Added the real team roster: Georgia, Maggie, James, Courteney, and Ria**

- **What we changed:** `src/config/team-members.json` now lists the five real team members (all Admins), each with their own colour used across profile owner badges and the Orbit view. Removed the old unused placeholders (a leftover `rs@caffeine.co` entry and a generic "Team" owner).
- **Also fixed along the way:** the app was still configured to treat `@caffeine.co` as the team's email domain, but real logins are `@caffeinedaily.co` (plus James at `@previously.co`). Updated the internal-domain setting and the setup docs so they match reality — otherwise calendar/email sync would have mistaken teammates for outside contacts.
- **Update:** ran `sync:team` to create real logins for all five, then a one-time cleanup (`cleanup:legacy-team`) to remove the two leftover placeholder accounts from the database. The team list is now exactly the 5 real people, each with a working login (temporary password `password123`, to be changed once real Google sign-in is set up).

**Narrowed tag categories to Expertise, Industry, Signal/Influence**

- **What we changed:** Tags used to be grouped as Sector / Role / Interest / Other. Replaced with exactly the three categories Ria wants going forward: Expertise, Industry, Signal/Influence. Updated the database rule, the "create tag" form, and the docs to match.
- **Still to do:** the database change needs to be run against the live project — see next steps in chat.

## 2026-07-06

**Fixed: merging two profiles with no email address could break later merges**

- **What was wrong:** When two profiles that both had no email address were merged, the system saved a blank placeholder instead of properly recording "no email." The next time any *other* pair of email-less profiles was merged, it collided with that leftover placeholder and threw a confusing error — "another profile already uses this email" — even though neither profile had one.
- **What we changed:** `src/lib/data/profile-merge.ts` and `src/types/database.ts`, so "no email" is now stored correctly instead of as a blank value.
- **Why it matters:** Merging duplicate profiles (a core admin task for cleaning up the contact list) now works no matter how many email-less profiles get merged over time.
