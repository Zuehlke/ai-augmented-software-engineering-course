# Lab 8 · Durable Workflows

## Context

From here on, agents mostly run unattended: in a loop, in parallel, in a pipeline. The harness in `.harness/` starts them and decides what comes next. It runs on [Temporal](https://temporal.io/), so when something crashes, the work goes on where it stopped.

This lab gets you comfortable with Temporal and the `flows` command you'll use in all the upcoming labs. Every interaction with Temporal is a `flows` command, such as `flows start`, `flows status` or `flows approve`. For this course, we also built a simple UI on top of them, `flows watch`, to better illustrate an agentic pipeline and its concepts.

You start and follow everything on that page. Behind it are these Temporal concepts:

<FlowsWatch scene="lab8-research" :notes="[
  { at: 'temporal', label: 'Temporal', text: 'remembers every workflow and step, so work survives a crash.\nCalled via `temporal server start-dev`.' },
  { at: 'worker', label: 'Worker', text: 'the process that runs the workflows and activities.\nCalled via `flows worker`.' },
  { at: 'map', label: 'Workflow', text: 'decides which step runs next. The four stages are one workflow.\nCalled via `flows start`.' },
  { at: 'log', label: 'Activity', text: 'one step that does real work, like an agent run. Retried if it fails.\nCalled by the workflow, its output via `flows logs`.' },
  { at: 'steps', label: 'Query', text: 'asks a running workflow how far it is.\nCalled via `flows status`.' },
]" />

In this lab, we do a simple activity: the **research agent** turns a feature request into a specification with the `research` skill from [Structured agentic workflows](./lab-4-structured-agentic-workflows.md). Temporal runs it, and you follow it on the page.

## Your Task

Start the lab setup with the following command:

```bash
task lab/durable-workflows
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/durable-workflows`.
>
> [![Open Lab 8 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fdurable-workflows)

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

### 1. Start Temporal and the worker

```bash
task flows:start
```

This starts a local Temporal server and the worker in the background. Temporal also has a web UI, at [http://localhost:8233](http://localhost:8233). In **GitHub Codespaces**, open the **Ports** tab and click the globe icon next to `Temporal UI` (port `8233`).

### 2. Open flows watch

```bash
task flows:watch
```

Open [http://localhost:8234](http://localhost:8234). In **GitHub Codespaces**, open the **Ports** tab and click the globe icon next to `flows watch` (port `8234`).

At the top, whether Temporal and the worker run. Below, the four stages from research to merge, the loops that run, and the agents' output. Hover over a part to see the command behind it. The agents use Claude Code: click **Copilot** next to **Agent** to switch to GitHub Copilot CLI.

<FlowsWatch scene="lab8-watch" />

### 3. Run the research agent

Start the pipeline with `flows start` and the feature request, in a new terminal:

<details>
<summary>Feature request: Flight Delays Dashboard</summary>

```bash
flows start "$(cat <<'EOF'
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
EOF
)"
```

</details>

<FlowsWatch scene="lab8-research" />

This will start the pipeline workflow in Temporal, and `flows start` follows it in the terminal. In this lab, it only goes as far as the research agent.

> [!NOTE]
> The research agent only sees what's committed. Commit or stash your changes before you start it.

In the Temporal web UI, click `pipeline` to see its history: every finished step, with its result. That's what makes it durable. If the worker crashes, a new one reads the history and only reruns what didn't finish.

### 4. Check the result

When the research agent and its judge are done, the pipeline waits for you: `flows start` asks `Approve the specification? [y/N]`, and the bar at the top of `flows watch` asks too. Read it in `specs/<slug>/specification.md`, on your branch. Don't approve it for now!

<FlowsWatch scene="lab8-specification" />

Stop Temporal and the worker:

```bash
task flows:stop
```

The page shows both as not running. Start them again with `task flows:start`: the pipeline still waits for your approval, at the same step. The next lab stops it when you switch to it.

In the next lab, you cut a specification like this one into tasks.
