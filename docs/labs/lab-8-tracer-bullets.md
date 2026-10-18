# Lab 8 · Tracer bullets

## Context

A feature request says what should happen, not how to split it into tickets. Done by hand, that's slow and inconsistent: blockers get missed, and work gets split by layer instead of into slices you can demo.

The `plan` skill splits it the same way every time. It first lists the blockers, such as a schema change or an open decision. Then it slices the rest into vertical tracer-bullet tickets: each one goes through every layer it touches.

## Your Task

Start the lab setup with the following command:

```bash
task lab/tracer-bullets
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/tracer-bullets`.
>
> [![Open Lab 8 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Ftracer-bullets)

The `plan` skill below is already in the repository. Paste the feature request below to your agent and ask it to invoke the skill on it:

<details>
<summary>Feature request: Flight Delays Dashboard</summary>

```markdown
# Flight Delays Dashboard

## Problem

Ops and support staff currently query the raw `/delays` endpoint by hand to answer basic questions:
"is this flight delayed", "how is this airline doing today". There's no airline-level view and no
per-flight status view, just one flat query.

## Goal

Give support staff a simple web page to answer, per airline and per flight, "what's the current delay
situation", without knowing the query API.

## Scope

1. **Airline overview** — for a given airline code, show its name and how many of its flights are
   currently active or scheduled.
2. **Flight status lookup** — for a given flight id, show its current status (on time / delayed /
   cancelled) and its delay in minutes.
3. **Airport reference data** — flights should show departure/arrival airport name, city, and
   timezone, not just IATA codes.
4. **Data model cleanup** — the current delay storage is one flat table; supporting (1)-(3)
   correctly and efficiently needs it normalized into separate airline/flight/delay-event tables.
5. **Simple UI** — one plain HTML page served by the app itself (no frontend framework, no separate
   build), with a search box for an airline code and one for a flight id. The views from (1)-(3) are
   shown on this page, not only exposed as endpoints.

## Non-goals

- No real-time push or streaming updates in this iteration.
- Ops/support tooling only, not a customer-facing UI: no styling beyond the basics, no login.

## Constraints

- Airport reference data (city, timezone per IATA code) isn't available in-house yet; the data team
  has been asked for a dataset export but has given no ETA.
- Any schema change to delay storage requires architecture review sign-off before implementation
  starts; that review is scheduled but not yet complete.
```

</details>

When the skill has written the tickets, review them in `backlog/`:

- <label><input type="checkbox"> Does each ticket go through every layer it touches, such as schema, service, and endpoint?</label>
- <label><input type="checkbox"> Can you demo or verify each ticket on its own once it's done?</label>
- <label><input type="checkbox"> Is prefactoring, such as a schema change, its own ticket, ordered before the tickets that need it?</label>
- <label><input type="checkbox"> Is a ticket only `ready` when nothing blocks it?</label>

## Solution

<details>
<summary><code>.agents/skills/plan/SKILL.md</code></summary>

````markdown
---
name: plan
description: Break a feature request, spec, or plan into a backlog of tracer-bullet tickets, each declaring what blocks it; use when asked to turn a requirements document into issues or a backlog.
disable-model-invocation: true
---

## TASK

Break a feature request, a spec, or the plan already discussed in this conversation into a set of
tickets under `backlog/`. You do not implement anything.

## STEPS

1. Read the feature request in full. Look for prefactoring: work that has to land before a feature
   can be built cleanly, a schema change, a missing dataset, a pending decision. "Make the change
   easy, then make the easy change." Prefactoring gets its own ticket(s), never folded into a
   feature ticket.

2. Break the remaining scope into vertical slices, not horizontal layers:
   - Each ticket cuts a narrow but complete path through every layer it touches (schema → service →
     endpoint), not one layer shared across many tickets.
   - A completed ticket is demoable or verifiable on its own; it must own every acceptance criterion
     it's graded on, never split a single demoable outcome across two tickets.
   - Each ticket should be sized to fit in a single agent session.
   - A behaviour and its combination with what already exists, "X together with Y", is one slice, not
     two. A ticket that would only add tests or wiring for another ticket's behaviour is folded into
     that ticket. A small request is one ticket.
   - Something several tickets share, such as the page they're shown on, is built by the first
     ticket that needs it, never as a ticket of its own.

3. Give every ticket its blocking edges: which other tickets, or which external things, must land
   before it can start. A ticket with no blocker is `ready`; anything else is `blocked`, however
   well-specified it is. Other tickets go in `blocked_by`, anything outside the repo in
   `blocked_reason`: a ticket blocked only by tickets can start as soon as they are done.

4. Present the breakdown as a numbered list before writing anything: title, blocked by, what it
   delivers. Ask whether the granularity and the blocking edges are right. Iterate until the user
   approves.

5. Only after approval, write one file per ticket to `backlog/TICKET-<n>-<slug>.md`, numbered after
   the highest ticket already in `backlog/`, in dependency order (blockers first). Don't change the
   existing tickets:

   ```markdown
   ---
   id: TICKET-<n>
   status: ready | blocked
   blocked_by: <only when it waits for other tickets: their ids, for example TICKET-3, TICKET-4>
   blocked_reason: <only when it waits for something outside the repo: name it>
   ---

   # <Title: the demoable outcome>

   <One or two sentences: what this makes work, from the user's perspective, not a layer-by-layer
   implementation list.>

   ## Acceptance Criteria

   - <objectively testable, false at the current commit>
   ```

## CONSTRAINTS

- No file paths, line numbers, or code in a ticket, only the outcome and its acceptance criteria.
- Never mark a ticket `ready` if its acceptance criteria depend on another ticket's work, or on
  something outside the repo that hasn't landed yet.
- Don't invent scope the feature request doesn't ask for.
````

Adapted from Matt Pocock's `to-tickets` skill.

</details>

<details>
<summary>Expected backlog (four tickets, in dependency order)</summary>

```markdown
---
id: TICKET-1
status: ready
---

# Normalize delay data model

Delay data is restructured from a single flat table into separate airline, flight, and delay-event
data, so airline-level and flight-level questions can be answered correctly and efficiently instead
of by scanning one flat table.

## Acceptance Criteria

- Airline data (code, name) is stored and queryable independently of individual delay records.
- Flight data (flight id, airline, departure/arrival airport codes, schedule) is stored and
  queryable independently of individual delay records.
- Delay/status events (on time / delayed / cancelled, delay minutes, timestamp) are stored linked to
  a specific flight, with multiple events per flight supported.
- Existing data currently reachable via the flat `/delays` endpoint is fully represented in the new
  structure with no data loss.
- Querying "all flights for a given airline" and "current status for a given flight" can each be
  answered with a single, efficient lookup rather than a full-table scan.
```

```markdown
---
id: TICKET-2
status: blocked
blocked_by: TICKET-1
---

# Airline overview dashboard

Support staff can open a single web page, enter an airline code, and see that airline's name plus
how many of its flights are currently active or scheduled, without writing any query themselves.

## Acceptance Criteria

- A web page served by the app (no separate frontend build) is reachable and displays a search box
  for an airline code.
- Submitting a valid airline code shows the airline's name and a count of its currently active or
  scheduled flights.
- Submitting an airline code that doesn't exist shows a clear "not found" message instead of an
  error page or a blank result.
- The result is produced from a lookup against real airline/flight data, not hand-entered or mocked
  values.
```

```markdown
---
id: TICKET-3
status: blocked
blocked_by: TICKET-1, TICKET-2
---

# Flight status lookup

On the same dashboard page, support staff can enter a flight number and see its current status (on
time / delayed / cancelled) and its delay in minutes, without knowing the query API.

## Acceptance Criteria

- The dashboard page shows a search box for a flight number, alongside the existing airline search box.
- Submitting a valid flight number shows its current status as one of: on time, delayed, or cancelled.
- Submitting a valid flight number that is delayed shows the delay in minutes.
- Submitting a flight number that doesn't exist shows a clear "not found" message instead of an error
  page or a blank result.
- The result reflects the flight's latest delay/status event from real data, not a hand-entered or
  mocked value.
```

```markdown
---
id: TICKET-4
status: blocked
blocked_by: TICKET-3
blocked_reason: an airport reference dataset (city, timezone per IATA code) that the data team has not yet delivered, with no ETA
---

# Airport reference enrichment for flight status

When looking up a flight's status, support staff see the departure and arrival airports' full name,
city, and timezone, instead of just the bare IATA codes.

## Acceptance Criteria

- The flight status lookup result shows, for both departure and arrival airports, the airport name,
  city, and timezone in addition to the IATA code.
- If airport reference data is missing for a given IATA code, the flight status lookup still
  displays the flight's status and delay, with a clear indication that airport details are
  unavailable rather than an error or blank fields.
```

The data model cleanup is prefactoring: it has to land before the dashboard can be built cleanly, so it gets its own ticket instead of being folded into the first feature ticket. Everything else is a vertical slice that is demoable in the browser the moment it lands.

The UI is not a ticket of its own. TICKET-2 introduces the dashboard page together with the airline search, TICKET-3 adds the flight search to that same page, and TICKET-4 enriches the flight result. A "build the dashboard page" ticket next to "add the endpoints" would be the horizontal split this lab is about avoiding.

Every blocker is explicit: TICKET-2 and TICKET-3 wait on the data model, TICKET-3 also on the page from TICKET-2, and TICKET-4 on both the flight status lookup and the airport dataset that has no ETA yet. Tickets go in `blocked_by`, anything outside the repo in `blocked_reason`: a ticket blocked only by tickets can start as soon as they are done, one with a `blocked_reason` waits for someone outside the team.

</details>

> [!NOTE]
> Claude Code uses `.claude/skills` rather than `.agents/skills`. The branch has a symlink, `.claude/skills` → `.agents/skills`, so Claude Code uses the same files. There is nothing to rename.