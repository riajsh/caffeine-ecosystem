# Ecosystem Product Brief V1

- Version: 1.0
- Status: Accepted
- Owner: Previously Unavailable
- Related: domain-model-v1.md, information-architecture.md, design-principles.md

---

## Problem statement

PU's most valuable asset is its network, and right now that network lives in inboxes, heads, spreadsheets and a Lovable prototype that stalled. Nobody can reliably answer "who do we know in X, who at PU knows them best, and when did we last talk to them". The cost is missed introductions, relationships that quietly go cold, and leadership making network decisions on memory rather than evidence.

## Who this is for

V1 is an internal tool for the PU team. Primary users are the people who hold relationships (James, Henry, Simon, Ria and the wider team) and leadership making network and opportunity decisions. It is not a go-to-market SaaS. Once stable, the platform is cloned, stripped of PU data and handed to Caffeine Daily as a separate instance.

## Goals

1. Make "who do we know in X" answerable in seconds, with evidence behind every result.
2. Surface who at PU owns each relationship and how warm it is, not just whether a contact exists.
3. Catch relationship decay automatically, so important people stop going dark unnoticed.
4. Give leadership an operating view of the network: ownership concentration, dormant clusters, event-driven opportunities.
5. Build the graph so that AI reasoning in Phase 3 has rich, traceable evidence to work from.

## Non-goals (V1)

1. **Subjective scoring fields** (Influence, Trust, Alignment, Warmth, Momentum). Humans will not maintain these. Out until the system can compute them from evidence.
2. **Claude chat or copilot.** AI is Phase 3, over a populated graph, not a day-one chat box.
3. **Multi-tenant SaaS, billing, public signup, self-serve onboarding.** Single org, clone for Caffeine. No commercial surface.
4. **Custom field builder UI.** Deferred. The `profiles.extended` jsonb is the interim escape hatch.
5. **Polished graph visualisation.** Orbit's interaction model gets validated before any visual systemisation.

## User stories

Owners (the team)
- As a relationship owner, I want to find everyone we know in a sector or location so that I can answer an opportunity quickly.
- As a relationship owner, I want to see who else at PU knows a person and how well, so that I route an introduction through the warmest path.
- As a relationship owner, I want a person's full timeline (emails, meetings, events, notes) so that I walk into a conversation with context.
- As a relationship owner, I want to log a note, meeting or introduction in a few seconds so that the record stays current.

Leadership
- As a leader, I want to see which relationships have gone quiet so that we re-engage before they lapse.
- As a leader, I want to see how network ownership is distributed across the team so that I understand concentration and single points of failure.
- As a leader, I want to see which people cluster around our events so that we run better rooms.

Admin
- As an admin, I want to import a CSV and have duplicates caught so that the database stays clean.
- As an admin, I want unmatched email participants surfaced for review so that the graph grows without filling with noise.

Edge and empty states
- As a new user opening Orbit with no activity data, I want a clear empty state that explains what populates it, not a blank canvas.
- As a user viewing an inferred connection, I want it visibly marked as inferred so that I do not mistake it for a confirmed relationship.

## Requirements

### Must have (P0)

- **Auth and org scoping.** Supabase auth, every row org-scoped, RLS on from day one.
  - Given a logged-in PU user, when they query any table, then they only ever see PU rows.
- **Profiles.** Create, read, edit, shared across the org.
- **Relationships and owners.** One relationship per profile, multiple owners with per-owner strength and a primary owner.
- **Activities timeline.** Per-profile chronological feed from manual entry and email sync.
- **CSV import.** With dedup on email and a review step for soft matches (see ADR 0004).
- **Gmail sync.** Daily cron, full project-related threads, generates activities, idempotent on re-run (see specs/gmail-sync.md).
- **Events and attendance.** Events as first-class objects with attendee records.
- **Search.** Across profiles, tags, activities, events and email subjects (see ADR 0006).
- **Tags.** Categorised, attached to profiles.

### Nice to have (P1)

- **Connections graph** (profile to profile), manual plus same-company and co-attended-event inference, inferred edges flagged.
- **Orbit** as a strength-and-recency visualisation with owner colouring.
- **Connect** suggestions: reconnect, introduce, emerging.
- **Watchlist.**

### Future considerations (P2)

- Computed relationship strength and last_interaction replacing manual fields.
- pgvector semantic search.
- Claude reasoning layer (Phase 3).
- The hidden scoring fields, surfaced only once evidence-backed.

## Success metrics

This is an internal tool, so success is adoption and answerability, not revenue.

Leading (weeks)
- A "who do we know in X" query returns a useful, evidence-backed result in under 10 seconds.
- Majority of the active team logs in weekly and records at least one activity or note.
- Email sync runs daily without manual intervention and attributes activities to the right profiles.

Lagging (months)
- Leadership uses Orbit or Connect in network and opportunity decisions, not memory.
- Measurable re-engagement of dormant relationships flagged by the system.
- The Caffeine clone stands up cleanly with zero PU data leakage.

## Open questions

None. All decisions closed. See `docs/decisions/` for ADRs 0001–0008 and `docs/pre-migration-gate.md` for the full pre-migration sign-off record (cleared 2026-06-20).

## Timeline and phasing

Foundation before features. See domain-model-v1.md section 12.
- Phase 1: foundation (auth, profiles, relationships, owners, activities, events, import, sync, search).
- Phase 2: intelligence (connections, Orbit, computed strength, Connect, watchlist).
- Phase 3: AI reasoning over the populated graph.

No hard external deadline. The gating dependency is data quality: Phase 2 and 3 only earn their place once Phase 1 holds real activity.
