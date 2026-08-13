# Build Log

A plain-language, dated history of what Ria and Claude have built, fixed, or changed together. Newest entries at the top.

---

## 2026-08-13

**Added the real team roster: Georgia, Maggie, James, Courteney, and Ria**

- **What we changed:** `src/config/team-members.json` now lists the five real team members (all Admins), each with their own colour used across profile owner badges and the Orbit view. Removed the old unused placeholders (a leftover `rs@caffeine.co` entry and a generic "Team" owner).
- **Also fixed along the way:** the app was still configured to treat `@caffeine.co` as the team's email domain, but real logins are `@caffeinedaily.co` (plus James at `@previously.co`). Updated the internal-domain setting and the setup docs so they match reality — otherwise calendar/email sync would have mistaken teammates for outside contacts.
- **Update:** ran `sync:team` to create real logins for all five, then a one-time cleanup (`cleanup:legacy-team`) to remove the two leftover placeholder accounts from the database. The team list is now exactly the 5 real people, each with a working login (temporary password `password123`, to be changed once real Google sign-in is set up).

## 2026-07-06

**Fixed: merging two profiles with no email address could break later merges**

- **What was wrong:** When two profiles that both had no email address were merged, the system saved a blank placeholder instead of properly recording "no email." The next time any *other* pair of email-less profiles was merged, it collided with that leftover placeholder and threw a confusing error — "another profile already uses this email" — even though neither profile had one.
- **What we changed:** `src/lib/data/profile-merge.ts` and `src/types/database.ts`, so "no email" is now stored correctly instead of as a blank value.
- **Why it matters:** Merging duplicate profiles (a core admin task for cleaning up the contact list) now works no matter how many email-less profiles get merged over time.
