# Build Log

A plain-language, dated history of what Ria and Claude have built, fixed, or changed together. Newest entries at the top.

---

## 2026-07-06

**Fixed: merging two profiles with no email address could break later merges**

- **What was wrong:** When two profiles that both had no email address were merged, the system saved a blank placeholder instead of properly recording "no email." The next time any *other* pair of email-less profiles was merged, it collided with that leftover placeholder and threw a confusing error — "another profile already uses this email" — even though neither profile had one.
- **What we changed:** `src/lib/data/profile-merge.ts` and `src/types/database.ts`, so "no email" is now stored correctly instead of as a blank value.
- **Why it matters:** Merging duplicate profiles (a core admin task for cleaning up the contact list) now works no matter how many email-less profiles get merged over time.
