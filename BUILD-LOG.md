# Build Log

A plain-language, dated history of what Ria and Claude have built, fixed, or changed together. Newest entries at the top.

---

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
