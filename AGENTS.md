# AGENTS.md

Ecosystem is a relationship intelligence platform for Previously Unavailable. It answers: who do we know, who at PU knows them, how strong is the relationship, and how do we create value through the network.

## Read these before building

- `docs/domain-model-v1.md` — the data model and source of truth.
- `docs/product-brief-v1.md` — what V1 is and is not.
- `docs/information-architecture.md` — navigation and screens.
- `docs/design-principles.md` — how it should feel.
- `docs/technical-architecture.md` — what lives where (read before SQL).
- `docs/ai-conventions.md` — stack, layer rules, and hard "never do" list.
- `docs/specs/gmail-sync.md` — email ingestion (highest-risk subsystem).
- `docs/specs/import-pipeline.md` — CSV import flow.
- `docs/specs/search.md` — FTS index design (applied in Phase 1 migrations; read before any search feature work).
- `docs/design-tokens.md` — @theme tokens, owner palette, strength colours, CVA pattern. Read before any UI work.
- `docs/build-quality.md` — session discipline, AI red team, Caffeine canary, schema-locked mode.
- `docs/decisions/` — accepted ADRs (0001–0008).

## Core rules

- Relationships are primary, not contacts.
- Schema is the source of truth. Generate types from it.
- RLS on every table. `org_id` comes from the session, never the client.
- Three layers stay separate: user-entered, computed (views), AI (Phase 3). AI never writes Layer 1 without human confirmation.
- No subjective scoring fields, no AI chat, no scoring in V1.
- Never hard-code PU anywhere except the `organisations` row. The platform gets cloned for Caffeine.
- Imports and syncs are idempotent.

When in doubt, follow `docs/ai-conventions.md`. If a decision is missing, add an ADR rather than guessing in code.
