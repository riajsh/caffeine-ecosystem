# ADR 0001: Org scoping and multi-tenancy

- Status: Accepted
- Date: 2026-06-20
- Deciders: PU team

## Context

V1 serves only PU, but the platform will be cloned, stripped of PU data and handed to Caffeine Daily. We need clean separation without building go-to-market SaaS machinery.

## Decision

- Every table carries `org_id`, set from the start.
- RLS on every table restricts reads and writes to the user's org.
- `org_id` is derived server side from the authenticated session, never accepted from the client.
- Nothing hard-codes PU beyond the single `organisations` row.
- Cloning to Caffeine means provisioning a fresh org (new project or new org row), running the same migrations, and importing none of PU's data.

## Consequences

- Slightly more discipline per query and per policy, paid once.
- The Caffeine handover becomes an empty clean instance rather than a rebuild.
- No billing, signup or self-serve onboarding is built. This is not a commercial SaaS.
