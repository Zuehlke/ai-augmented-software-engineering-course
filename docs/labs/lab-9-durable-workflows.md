# Lab 9 · Durable Workflows

## Context

From here on, agents run unattended: in a loop, in parallel, in a pipeline. Something has to start them, check their work and decide what comes next. In this course, that's `.harness/flows/`, a small TypeScript project that runs on [Temporal](https://temporal.io/).

Unattended work takes long, and things go wrong along the way: a loop runs for an hour, an agent run crashes. Temporal saves every finished step on a server. If the process doing the work dies, a new one continues where the old one stopped, instead of starting over.

The four Temporal terms you need in this lab:

| Term | What it means |
| --- | --- |
| **Workflow** | A function that decides what happens next, for example "for every ticket, run an agent". It does no work itself. |
| **Activity** | One piece of real work the workflow asks for, for example an agent run. Temporal saves its result and retries it when it fails. |
| **Worker** | The process that runs the workflows and their activities. |
| **Query** | A question to a running workflow, for example "how far are you?". |

In this lab, you run a workflow that doesn't change any code: the **plan agent**, an agent with the `slice` skill from [Tracer bullets](./lab-8-tracer-bullets.md), turns a specification into tickets.

## Your Task

Start the lab setup with the following command:

```bash
task lab/durable-workflows
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/durable-workflows`.
>
> [![Open Lab 9 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fdurable-workflows)

The branch contains the tracer-bullet `backlog/`, a specification in `specs/`, the sandbox profile in `.harness/sandbox/` and the workflows in `.harness/flows/`. The dev container already has the Temporal CLI and the `flows` command. Check both:

```bash
temporal --version
flows
```

`flows` without a command lists all its commands.

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

You'll use two terminals.

### 1. Start Temporal and the worker

In **terminal 1**:

```bash
task flows:start
```

This starts a local Temporal server and the worker, both in the background. The server saves the workflows in a file, so they also survive a restart of the server. The worker runs the workflows and starts the agents.

Open the web UI at [http://localhost:8233](http://localhost:8233). In **GitHub Codespaces**, open the **Ports** tab and click the globe icon next to `Temporal UI` (port `8233`).

### 2. Watch the workflows

Still in **terminal 1**. If you use GitHub Copilot CLI, set `AGENT=copilot` there first. The default is Claude Code.

```bash
task flows:watch
```

`flows watch` is a terminal UI that shows what runs: the workflows, and below them the worker's output, the agents' output included. `↑` and `↓` scroll the output, `End` follows the new lines again. Leave it open.

<FlowsWatch scene="lab9-watch" />

### 3. Read the specification

The plan agent works from a specification, like the one the research phase wrote in [Structured agentic workflows](./lab-4-structured-agentic-workflows.md). The branch already has one, committed: `specs/delays-csv-export/specification.md`. Support staff want to download the current delays as a CSV file, filtered by airline. Read it before you hand it to the plan agent.

### 4. Run the workflow

<FlowsWatch scene="lab9-plan" />

In `flows watch` in terminal 1, press `→` to select the **Plan tickets** phase and press `Enter`. Pick `specs/delays-csv-export/specification.md` and press `Enter` again.

The workflow hands the specification to the plan agent, which writes its tickets to `backlog/`, next to the four from Lab 8. It works on a branch of its own and commits the tickets there. At the end, the workflow brings them onto your branch. `flows watch` shows the workflow under **Other workflows**, and the agent's output below.

> [!NOTE]
> The plan agent only sees what's committed, and the tickets can only come onto your branch if it has no uncommitted changes. Commit or stash your changes before you start the plan agent. If you change the specification or the `slice` skill, commit the change, or the workflow refuses to start.

::: code-group

```ts [.harness/flows/src/workflows/plan.ts]
import { ApplicationFailure, log, setHandler, workflowInfo } from '@temporalio/workflow';
import type { PlanInput, PlanStatus } from '../shared';
import { addWorktree, currentBranch, headCommit, listTickets, mergeBranch, removeWorktree, requireCommitted, runAgent } from './activities';
import { skillFile, workPrompt } from './prompts';
import { planStatus } from './signals';

// The plan agent: it uses the slice skill to turn a feature request or a specification into tickets in backlog/
export async function plan({ repoDir, agent, request, spec }: PlanInput): Promise<string[]> {
  const status: PlanStatus = { step: 'planning', newTickets: [] };
  setHandler(planStatus, () => status);

  // The plan agent works on a branch of its own. Its tickets come onto the branch you're on now.
  if (spec) await requireCommitted(repoDir, spec);
  await requireCommitted(repoDir, skillFile('slice'));
  const into = await currentBranch(repoDir);
  const name = `plan-${workflowInfo().runId.slice(0, 8)}`;
  const branch = `agent/${name}`;
  const workDir = await addWorktree(repoDir, name, branch, await headCommit(repoDir));

  // Activity: read the tickets already in backlog/
  const before = await listTickets(workDir);

  // Activity: one agent run. It takes minutes, and it's the one you'll interrupt.
  log.info('== plan');
  await runAgent({ repoDir, workDir, agent, mode: 'write', step: 'slice', prompt: workPrompt('slice', spec ? `Specification: ${spec}` : `Feature request: ${request}`) });

  // Activity: the tickets the plan agent added
  status.newTickets = (await listTickets(workDir)).filter((ticket) => !before.includes(ticket));

  // Activities: the tickets come onto your branch
  const problem = await mergeBranch(repoDir, branch, into);
  if (problem) {
    throw ApplicationFailure.nonRetryable(`The tickets are on ${branch}, not on ${into}: ${problem}. Then: git rebase ${into} ${branch} && git merge --ff-only ${branch}`);
  }
  await removeWorktree(repoDir, name, branch);
  status.step = 'done';
  return status.newTickets;
}
```

:::

Every `await` line is an **activity**. Temporal saves each activity's result in the workflow's **history**. If the worker stops, a new one runs the function again from the top, takes finished results from the history, and only reruns what didn't finish.

In the web UI, click `plan` to see its history.

`flows watch` doesn't read the history. Every few seconds, it asks each running workflow for its `status`: a **query**. In the code above, `setHandler(planStatus, ...)` answers it.

### 5. Stop the worker

<FlowsWatch scene="lab9-restart" />

While the plan agent is still working (terminal 1 shows its output), stop the worker, and the Temporal server with it. In terminal 2:

```bash
task flows:stop
```

`flows watch` in terminal 1 keeps running and shows that Temporal isn't running. Then start both again:

```bash
task flows:start
```

The workflow continues where it stopped, even though the server restarted too: its history was saved in the server's file. `addWorktree` and `listTickets` don't run again, their results are already in the history. Only the agent run starts again, about 30 seconds later: that's the retry delay set for `runAgent`.

::: code-group

```ts [.harness/flows/src/workflows/activities.ts (excerpt)]
// An agent run takes minutes. It heartbeats every 10 seconds, so when the worker dies, Temporal
// notices after 1 minute (heartbeatTimeout) instead of 45, and runs it again on the next worker.
export const { runAgent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '45 minutes',
  heartbeatTimeout: '1 minute',
  retry: { maximumAttempts: 3, initialInterval: '30 seconds' },
});
```

:::

### 6. Check the result

<FlowsWatch scene="lab9-board" />

When the workflow is done, press `Tab` in `flows watch`: the backlog board shows the new tickets next to the four from Lab 8. Select one with the arrow keys and press `Enter` to read it, or open them in `backlog/`. Check them as you did in Lab 8: does every ticket cut a full vertical slice, and does every `ready` ticket really not depend on another one?

You now have a server, a worker and a workflow that survives its worker. In the next lab, a workflow changes code.
