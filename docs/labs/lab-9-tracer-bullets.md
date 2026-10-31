# Lab 9 · Tracer bullets

## Context

A specification says what should happen, not how to split it into tasks. Done by hand, that's slow and inconsistent: blockers get missed, and work gets split by layer instead of into slices you can demo.

The `plan` skill splits it the same way every time. It first lists the blockers, such as a schema change or an open decision. Then it slices the rest into vertical tracer-bullet tasks: each one goes through every layer it touches.

## Your Task

Start the lab setup with the following command:

```bash
task lab/tracer-bullets
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/tracer-bullets`.
>
> [![Open Lab 9 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Ftracer-bullets)

The `plan` skill below is already in the repository, and so are a reviewed specification of the dashboard, like the one from the last lab, and its design, in `specs/flight-delays-dashboard/`. Invoke the skill with their slug:

```text
/plan flight-delays-dashboard
```

<details>
<summary>The specification and the design (already in the branch)</summary>

::: code-group

```markdown [specs/flight-delays-dashboard/specification.md]
# Support staff see the delay situation per airline and per flight on one web page

Support staff answer "is this flight delayed" and "how is this airline doing today" without querying
`GET /delays` by hand: one page served by the app shows an airline's overview and a flight's status.
To answer this correctly and efficiently, the flat delay table is split into airlines, flights and
delay events.

## Acceptance Criteria

- Airlines (code, name) are stored apart from the delay records, and an airline can be looked up by
  its code.
- Flights (flight number, airline, departure and arrival airport codes, schedule) are stored apart
  from the delay records.
- Delay and status events (on time / delayed / cancelled, delay in minutes, timestamp) are stored per
  flight, several per flight. A flight's current status is its latest event.
- Every flight `GET /delays` returns today is in the new structure, and `GET /delays` answers exactly
  as before, with and without `airline_code`.
- All flights of an airline, and the current status of a flight, are each found with one indexed
  lookup, not by scanning all delay records.
- The app serves one plain HTML page, `/dashboard.html`, with a search box for an airline code and one
  for a flight number.
- An existing airline code shows the airline's name and how many of its flights are active or
  scheduled, that is, not cancelled.
- An existing flight number shows its current status: on time, delayed or cancelled. A delayed flight
  also shows its delay in minutes.
- An airline code or a flight number that doesn't exist shows a clear "not found" message, not an error
  page or an empty result.
- The flight status shows the departure and arrival airport's name, city and timezone next to the IATA
  code. When the reference data has no entry for a code, the status and delay still show, with a note
  that the airport details are unavailable.
- What the page shows comes from the stored data, not from hand-entered or mocked values.

## Constraints

- One plain HTML page served by the app: no frontend framework, no separate build, no styling beyond
  the basics, no login.
- The airport reference data (name, city, timezone per IATA code) comes from a dataset the data team
  hasn't delivered yet, with no ETA. The airport details can't be built before it arrives.

## Non-goals

- Real-time push or streaming updates.
- A customer-facing UI.

## Assumptions

- The architecture review of the delay storage schema change is signed off, so the data model can
  change now.
- An airline code is the prefix of its flight numbers (`LX` for `LX100`), the way
  `GET /delays?airline_code=LX` matches today. The existing data stores airline names (`SWISS`), so
  the new airline data keeps both the code and the name.
- "Flight id" in the request means the flight number, for example `LX100`: that's what support staff
  know.

## Risks

- The airport dataset may arrive late or not at all. Everything else must work without it, so the
  airport details have to be a slice of their own that can wait.
```

```markdown [specs/flight-delays-dashboard/design.md]
# Design - Flight delays dashboard

## Architectural design

- **Data model.** The flat `flights` table becomes three tables in `schema.sql`:
  - `airlines` (`CODE` primary key, `NAME`)
  - `flights` (`ID`, `FLIGHT_NUMBER`, `AIRLINE_CODE` referencing `airlines`, `DEPARTURE_AIRPORT`,
    `ARRIVAL_AIRPORT`, `SCHEDULED_TIME`), with an index on `AIRLINE_CODE`
  - `delay_events` (`ID`, `FLIGHT_ID` referencing `flights`, `STATUS`, `DELAY_MINUTES`, `ACTUAL_TIME`,
    `RECORDED_AT`), with an index on (`FLIGHT_ID`, `RECORDED_AT`)

  `data.sql` moves every existing row into them: one airline per flight number prefix, keeping today's
  airline name, one flight per row, one delay event per row.
- **Repositories** (Spring Data JDBC, in `repository/`, records like the existing `Flight`):
  `Airline` + `AirlineRepository`, `Flight` (reshaped) + `FlightRepository` with
  `findByAirlineCode` and `findByFlightNumber`, `DelayEvent` + `DelayEventRepository` with a query for a
  flight's latest event.
- **Latest event.** A flight's current status is its event with the latest `RECORDED_AT`. Two events with
  the same timestamp: the higher `ID` wins. A flight without events counts as on time.
- **`GET /delays`** keeps its contract: it builds the same `DelayView` (flight number, airline name,
  status, delay minutes) from a flight, its airline and its latest event.
- **`DashboardController`**, new, JSON for the page:
  - `GET /airlines/{code}/overview` returns the code, the name and the count of flights whose latest
    status isn't `CANCELLED`; `404` for an unknown code.
  - `GET /flights/{flightNumber}/status` returns the flight number, the latest status and the delay;
    `404` for an unknown flight number.
  - Codes and flight numbers are matched case-insensitively.
- **The page**, `src/main/resources/static/dashboard.html`: plain HTML and a small inline script. Each
  search box calls its endpoint and shows the result, or "not found" on a `404`.
- **Airport details** wait for the reference dataset: an `airports` table (`IATA_CODE`, `NAME`, `CITY`,
  `TIMEZONE`) loaded from it, and the flight status adds both airports' details, or marks them
  unavailable when the code has no entry.

## Files to change

- `src/main/resources/schema.sql`, `src/main/resources/data.sql`
- `src/main/java/com/zuhlke/lab/flights/repository/`: `Flight.java`, `FlightRepository.java`, new
  `Airline.java`, `AirlineRepository.java`, `DelayEvent.java`, `DelayEventRepository.java`
- `src/main/java/com/zuhlke/lab/flights/controller/DelaysController.java`, new `DashboardController.java`
- New `src/main/resources/static/dashboard.html`

## Test implementation plan

### Test files
- New `repository/DelayDataModelTest.java`, new `controller/DashboardControllerTest.java`, new
  `controller/DashboardPageTest.java`; the existing `controller/DelaysControllerTest.java` stays green.

### Test classes
- `DelayDataModelTest`: `@DataJdbcTest` against the real schema and data.
- `DashboardControllerTest`, `DashboardPageTest`: `@SpringBootTest` with `MockMvc`, like `DelaysControllerTest`.

### Test methods
- Data model: airlines by code, flights by airline, several events per flight, the latest event (also
  with equal timestamps), every former row present.
- Overview: a known code with its count, cancelled flights left out, an unknown code is `404`, a
  lower-case code.
- Flight status: on time, delayed with minutes, cancelled, an unknown flight number is `404`.
- Page: `/dashboard.html` is served and has both search boxes.

## Code implementation plan

### Source files
- As in Files to change.

### Functions/endpoints
- `GET /airlines/{code}/overview`, `GET /flights/{flightNumber}/status`; `GET /delays` unchanged on the
  outside.

### Helpers/utilities
- One place that picks a flight's latest event, used by `GET /delays` and `DashboardController`.

## Integration plan

- The page uses only the app's own endpoints and static resources: no build step, no new dependency.
- `README.md` lists the dashboard page and the two endpoints.
- The schema is recreated from `schema.sql` and `data.sql` at every start: there's no migration of
  existing databases.

## Validation plan

- `task test` passes, the existing `DelaysControllerTest` unchanged.
- Manually: `task run`, open `/dashboard.html`, look up `LX` and `LX100`, then an unknown code and an
  unknown flight number.
- Edge cases: lower-case input, a cancelled flight, a flight with two events at the same time.
- Error conditions: an unknown code or flight number shows "not found", never an error page.
```

:::

</details>

When the skill has written the tasks, review them in `backlog/`:

- <label><input type="checkbox"> Does each task go through every layer it touches, such as schema, service, and endpoint?</label>
- <label><input type="checkbox"> Can you demo or verify each task on its own once it's done?</label>
- <label><input type="checkbox"> Is prefactoring, such as a schema change, its own task, ordered before the tasks that need it?</label>
- <label><input type="checkbox"> Is a task only `ready` when nothing blocks it?</label>

## Solution

<details>
<summary><code>.agents/skills/plan/SKILL.md</code></summary>

````markdown
---
name: plan
description: Break a feature request, spec, or plan into a backlog of tracer-bullet tasks, each declaring what blocks it; use when asked to turn a requirements document into issues or a backlog.
disable-model-invocation: true
---

## TASK

Break a feature request, a spec, or the plan already discussed in this conversation into a set of
tasks under `backlog/`. You do not implement anything.

## STEPS

1. Read the feature request in full. Given only a slug, it is `specs/<slug>/specification.md`. Read the
   `design.md` next to a specification too, if there is one: cut the tasks along its decisions. Look for
   prefactoring: work that has to land before a feature can be built cleanly, a schema change, a missing
   dataset, a pending decision. "Make the change easy, then make the easy change." Prefactoring gets its
   own task(s), never folded into a feature task.

2. Break the remaining scope into vertical slices, not horizontal layers:
   - Each task cuts a narrow but complete path through every layer it touches (schema → service →
     endpoint), not one layer shared across many tasks.
   - A completed task is demoable or verifiable on its own; it must own every acceptance criterion
     it's graded on, never split a single demoable outcome across two tasks.
   - Each task should be sized to fit in a single agent session.
   - A behaviour and its combination with what already exists, "X together with Y", is one slice, not
     two. A task that would only add tests or wiring for another task's behaviour is folded into
     that task. A small request is one task.
   - Something several tasks share, such as the page they're shown on, is built by the first
     task that needs it, never as a task of its own.

3. Give every task its blocking edges: which other tasks, or which external things, must land
   before it can start. A task with no blocker is `ready`; anything else is `blocked`, however
   well-specified it is. Other tasks go in `blocked_by`, anything outside the repo in
   `blocked_reason`: a task blocked only by tasks can start as soon as they are done.

4. Present the breakdown as a numbered list before writing anything: title, blocked by, what it
   delivers. Ask whether the granularity and the blocking edges are right. Iterate until the user
   approves.

5. Only after approval, write one file per task to `backlog/TASK-<n>-<slug>.md`, numbered after
   the highest task already in `backlog/`, in dependency order (blockers first). Don't change the
   existing tasks:

   ```markdown
   ---
   id: TASK-<n>
   status: ready | blocked
   blocked_by: <only when it waits for other tasks: their ids, for example TASK-3, TASK-4>
   blocked_reason: <only when it waits for something outside the repo: name it>
   design: <only when you cut it from a design: its path, for example specs/<slug>/design.md>
   ---

   # <Title: the demoable outcome>

   <One or two sentences: what this makes work, from the user's perspective, not a layer-by-layer
   implementation list.>

   ## Acceptance Criteria

   - <objectively testable, false at the current commit>
   ```

## CONSTRAINTS

- No file paths, line numbers, or code in a task, only the outcome and its acceptance criteria.
- Never mark a task `ready` if its acceptance criteria depend on another task's work, or on
  something outside the repo that hasn't landed yet.
- Don't invent scope the feature request doesn't ask for.
````

</details>

<details>
<summary>Expected backlog (four tasks, in dependency order)</summary>

```markdown
---
id: TASK-1
status: ready
design: specs/flight-delays-dashboard/design.md
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
id: TASK-2
status: blocked
blocked_by: TASK-1
design: specs/flight-delays-dashboard/design.md
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
id: TASK-3
status: blocked
blocked_by: TASK-1, TASK-2
design: specs/flight-delays-dashboard/design.md
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
id: TASK-4
status: blocked
blocked_by: TASK-3
blocked_reason: an airport reference dataset (city, timezone per IATA code) that the data team has not yet delivered, with no ETA
design: specs/flight-delays-dashboard/design.md
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

</details>

> [!NOTE]
> Claude Code uses `.claude/skills` rather than `.agents/skills`. The branch has a symlink, `.claude/skills` → `.agents/skills`, so Claude Code uses the same files. There is nothing to rename.