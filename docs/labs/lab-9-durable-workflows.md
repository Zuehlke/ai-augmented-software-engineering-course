# Lab 9 · Durable Workflows

## Context

From here on, agents run unattended: in a loop, in parallel, in a pipeline. The harness in `.harness/` starts them and decides what comes next. It runs on [Temporal](https://temporal.io/), so when something crashes, the work goes on where it stopped.

This lab gets you comfortable with Temporal and the terminal UI you'll use in all the upcoming labs.

You start and follow everything in the terminal UI. Behind it are these Temporal concepts:

<FlowsWatch scene="lab9-plan" :notes="[
  { boxes: [[73, 0, 10, 1]], lx: 38, ly: 2, label: 'Temporal', text: 'remembers every workflow and step, so work survives a crash.\nCalled via `temporal server start-dev`.' },
  { boxes: [[86, 0, 8, 1]], lx: 56, ly: 2, label: 'Worker', text: 'the process that runs the workflows and activities.\nCalled via `flows worker`.' },
  { boxes: [[2, 4, 116, 6]], lx: 22, ly: 10.2, label: 'Workflow', text: 'decides which step runs next. The four phases are one workflow.\nCalled via `flows start`, the plan agent via `flows plan`.' },
  { boxes: [[4, 16, 72, 3]], lx: 4, ly: 20, label: 'Activity', text: 'one step that does real work, like an agent run. Retried if it fails.\nCalled by the workflow, its output via `flows logs`.' },
  { boxes: [[30, 12, 11, 1]], lx: 30, ly: 14, label: 'Query', text: 'asks a running workflow how far it is.\nCalled via `flows status`.' },
]" />

In this lab, we do a simple activity: the **plan agent** turns a specification into tickets with the `plan` skill from [Tracer bullets](./lab-8-tracer-bullets.md). Temporal runs it, and you follow it in the terminal UI.

## Your Task

Start the lab setup with the following command:

```bash
task lab/durable-workflows
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/durable-workflows`.
>
> [![Open Lab 9 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fdurable-workflows)

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

At the top, the tabs: **Pipeline** and **Board**, which `Tab` switches between, and whether Temporal and the worker run. Below, the four phases from research to merge, the workflows that run, and the agents' output, which `↑` and `↓` scroll. The agents use Claude Code: press `a` to switch to GitHub Copilot CLI.

<FlowsWatch scene="lab9-watch" />

### 3. Run the plan agent

The branch has a specification, `specs/delays-csv-export/specification.md`: support staff want to download the current delays as a CSV file. Press `→` to select **Plan**, press `Enter`, pick the specification and press `Enter` again.

<FlowsWatch scene="lab9-plan" />

This will start a simple workflow in Temporal.

> [!NOTE]
> The plan agent only sees what's committed. Commit or stash your changes before you start it.

In the web UI, click `plan` to see its history: every finished step, with its result. That's what makes it durable. If the worker crashes, a new one reads the history and only reruns what didn't finish.

### 4. Check the result

When the workflow is done, press `Tab`: the board shows the new tickets next to the four from Lab 8. Select one and press `Enter` to read it.

<FlowsWatch scene="lab9-board" />

In the next lab, a workflow changes code.
