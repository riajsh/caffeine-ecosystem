# ADR 0009: Phase 3 agent workflows

- Status: Accepted
- Date: 2026-06-21
- Deciders: PU team (Chris)

## Context

Phase 3 is described in the domain model as "Claude reasons over profiles, relationships, owners, connections, activities, emails and events." That framing is correct but underspecified. This ADR captures the concrete agent patterns that are in scope, the trigger data they depend on, and the human-in-the-loop principle that governs all of them.

Two observations led to this decision:

1. **Calendar sync (Phase 1.1, ADR 0008) is not just activity capture — it is the primary trigger for the most valuable agent workflows.** Email sync gives breadth (volume of correspondence). Calendar meetings give depth: bilateral confirmed interactions, group attendance (who was in the room together), and multi-party connection signals that email threads cannot provide. The agent layer is only possible once calendar sync exists.

2. **The value gap in current CRM tooling is not data capture — it is the action gap.** People know they should follow up, make the intro, or re-engage a dormant relationship. They don't, because the next action is never obvious, never surfaced at the right moment, and never drafted for them. Agents that close this gap — surfacing the right action at the right time, with a draft ready to confirm — are the highest-leverage capability in the system.

## Decision

Design the Phase 3 agent layer around four workflows. All agents operate on Layer 1 (user-entered facts) and Layer 2 (computed views) as read-only inputs. **No agent writes to Layer 1 without explicit human confirmation.** The agent surfaces and drafts; the human confirms.

---

### Agent 1: Meeting intelligence

**Trigger:** A calendar event syncs with at least one external participant.

**What it does:**

1. Matches participants against Ecosystem profiles by email.
2. Flags any participants not yet in Ecosystem: "You've met with Sarah Chen 3 times this month. She's not in Ecosystem. Want to add her?" Pre-fills name, company, and email from the calendar invite. One-click confirm.
3. Drafts an activity note for each matched profile: "You met with Aaron Croft on Tuesday at Drumbeat. Confirm to add to timeline?" Human confirms or edits before anything is written.
4. Infers person-to-person connections from multi-party meetings. If James, Aaron, and Priya were all in the same calendar meeting, that's a `connection` signal between Aaron and Priya (source=`calendar_sync`, type=`met_at_event`). Queued for human confirmation before the connection row is written.

**Why this matters:** Email threads tell you who you talked to. Calendar meetings tell you who knows each other. This is the primary mechanism by which the connections graph populates itself from real evidence rather than manual entry.

---

### Agent 2: Relationship health

**Trigger:** Weekly scheduled run.

**What it does:**

Identifies relationships drifting toward or already in the "reconnect" or "dormant" orbit band, then proposes a specific next action — not just a flag. The agent has access to:
- Orbit ring and recency band (Layer 2)
- Upcoming calendar events (calendar sync)
- Tags and relationship type

Example output: "Aaron Croft is moving to reconnect. You have the Climate Summit on the invite list next month — want to add him?" Or: "You haven't interacted with 4 of your inner circle contacts in over 6 months. Here are draft outreach messages for each."

The specificity of the proposed action is what makes this useful. A bare recency flag is ignored; a draft message is sent.

---

### Agent 3: Event preparation

**Trigger:** A PU event appears in the calendar within 48 hours, or an event record in Ecosystem moves to confirmed status.

**What it does:**

Generates a per-attendee briefing for whoever is running the event. For each confirmed attendee:
- Name, company, relationship strength, last interaction
- Who else attending that they should meet (shared tags, adjacent companies, complementary roles)
- Suggested conversation opener based on recent activities
- Any introduction opportunities ("Aaron and Priya haven't met but both work in climate")

Output is a generated briefing document, not data written to the database. The team walks in briefed.

---

### Agent 4: Introduction facilitation

**Trigger:** A user initiates an introduction activity (activity_type=`introduction`, introduced_by set).

**What it does:**

1. Drafts the introduction email with context about both parties pulled from their profiles, recent activities, and shared connections. Human edits and sends from their own email.
2. Watches for outcome signals: did those two people subsequently appear in a calendar meeting together? If yes, surfaces "It looks like Aaron and Priya connected. Mark this introduction as led_to_meeting?"
3. Updates `introduction_outcome` on human confirmation.

This closes the loop on introductions that currently disappear into email threads with no record of whether they landed.

---

## Calendar sync as prerequisite

Agents 1, 2, and 3 all depend on calendar sync (ADR 0008). Agent 1 and 3 depend on it directly as their trigger. Agent 2 uses upcoming calendar events to make action suggestions specific rather than generic. The agent layer is not buildable in Phase 3 without Phase 1.1 calendar sync in place.

This reinforces that calendar sync should be treated as a Phase 1.1 priority, not a nice-to-have.

## Human-in-the-loop principle

All four agents follow the same rule: **agents surface and draft; humans confirm.** Specifically:

- No profile is created without a human clicking confirm
- No activity is written to the timeline without a human confirming
- No connection is created without a human approving the inference
- No introduction outcome is updated without a human marking it

This is not just a safety measure — it is what makes the data trustworthy. Layer 1 facts are things humans have confirmed. Layer 2 inferences are computed from those facts. Layer 3 agents reason over both. None of this works if Layer 3 silently contaminates Layer 1 with its guesses.

## Consequences

- ADR 0008 (calendar sync) is promoted from "nice capture mechanism" to "prerequisite for the agent layer." Build it in Phase 1.1 as planned.
- Phase 3 planning should start from these four workflows, not from a blank "add AI" brief.
- The domain model §11 should be updated to reference Phase 3 agent workflows by name.
- The event preparation agent reinforces the case for adding event_type, event_size, and event_purpose fields to the events table — context the agent needs to generate useful briefings. Add these as optional columns when the events screen is built.
- The introduction facilitation agent validates the `introduction_outcome` enum already in the schema. No schema change needed.
