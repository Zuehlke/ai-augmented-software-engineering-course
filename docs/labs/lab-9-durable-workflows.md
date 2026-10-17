# Lab 9 · Durable Workflows

## Context

From here on, agents run unattended: in a loop, in parallel, in a pipeline. Something has to start them, check their work and decide what comes next. In this course, that's the harness in `.harness/`, which runs on [Temporal](https://temporal.io/). Unattended work takes long, and things go wrong along the way. Temporal saves every finished step, so when something crashes, the work goes on where it stopped instead of starting over.

You won't call Temporal yourself. `flows watch`, a terminal UI, shows what runs and lets you start it. In the background, it uses these Temporal concepts:

| Temporal | What it is | In `flows watch` |
| --- | --- | --- |
| **Workflow** | A function that decides what happens next, for example "for every ticket, run an agent". It does no work itself. | Every agent you start: the plan agent, later the Ralph loops and the pipeline. |
| **Activity** | One piece of real work a workflow asks for, for example an agent run. Temporal saves its result and retries it when it fails. | The agent's output, below the workflows. |
| **Worker** | The process that runs the workflows and their activities. | `● Worker` in the header. |
| **Query** | A question to a running workflow: "how far are you?". | Every few seconds, to show where each workflow is. |

Everything `flows watch` does is also a command: `flows` lists them.

In this lab, you start one workflow: the **plan agent**, with the `plan` skill from [Tracer bullets](./lab-8-tracer-bullets.md), turns a specification into tickets.

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

<FlowsWatch scene="lab9-watch" />

At the top, the tabs: **Pipeline** and **Board**, which `Tab` switches between, and whether Temporal and the worker run. Below, the four phases from research to merge, the workflows that run, and the agents' output, which `↑` and `↓` scroll. The agents use Claude Code: press `a` to switch to GitHub Copilot CLI.

### 3. Run the plan agent

<FlowsWatch scene="lab9-plan" />

The branch has a specification, `specs/delays-csv-export/specification.md`: support staff want to download the current delays as a CSV file. Press `→` to select **Plan**, press `Enter`, pick the specification and press `Enter` again. That's `flows plan --spec specs/delays-csv-export/specification.md`.

`flows watch` started a **workflow**, `plan`, under **Other workflows**. Its agent run is an **activity**: the **worker** runs it, and its output shows below. The plan agent works on a branch of its own, and at the end, the workflow brings its tickets onto yours.

> [!NOTE]
> The plan agent only sees what's committed. Commit or stash your changes before you start it.

In the web UI, click `plan` to see its history: every finished step, with its result. That's what makes it durable. If the worker crashes, a new one reads the history and only reruns what didn't finish.

### 4. Check the result

<FlowsWatch scene="lab9-board" />

When the workflow is done, press `Tab`: the board shows the new tickets next to the four from Lab 8. Select one and press `Enter` to read it. Check them as you did in Lab 8: is every ticket a vertical slice, and does every `blocked` ticket name what blocks it?

In the next lab, a workflow changes code.
