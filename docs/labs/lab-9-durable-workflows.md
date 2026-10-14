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

In this lab, you run a workflow that doesn't change any code: the **plan agent**, an agent with the `slice` skill from [Tracer bullets](./lab-8-tracer-bullets.md), turns a feature request into tickets.

## Your Task

Start the lab setup with the following command:

```bash
task lab/durable-workflows
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/durable-workflows`.
>
> [![Open Lab 9 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fdurable-workflows)

The branch contains the tracer-bullet `backlog/`, the sandbox profile in `.harness/sandbox/` and the workflows in `.harness/flows/`. The dev container already has the Temporal CLI and the `flows` command. Check both:

```bash
temporal --version
flows
```

`flows` without a command lists all its commands.

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

You'll use three terminals.

### 1. Start the Temporal server

In **terminal 1**:

```bash
temporal server start-dev --db-filename ~/temporal.db
```

This starts a local Temporal server. `--db-filename` saves the workflows in a file, so they also survive a restart of the server.

Open the web UI at [http://localhost:8233](http://localhost:8233). In **GitHub Codespaces**, open the **Ports** tab and click the globe icon next to `Temporal UI` (port `8233`).

### 2. Start the worker

In **terminal 2**:

```bash
flows worker
```

The worker runs the workflows and starts the agents. Their output shows up here. Leave it open.

### 3. Run the workflow

In **terminal 3**:

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

```bash
AGENT=copilot flows plan "Support staff can download the current delays as a CSV file, and filter the download by airline."
```

  </template>
  <template #tab2>

```bash
flows plan "Support staff can download the current delays as a CSV file, and filter the download by airline."
```

  </template>
</ContentTabs>

The workflow hands the feature request to the plan agent, which writes its tickets to `backlog/`, next to the four from Lab 8. It works on a branch of its own and commits the tickets there. At the end, the workflow brings them onto your branch, and terminal 3 prints the new ticket ids.

> [!NOTE]
> The plan agent only sees what's committed, and the tickets can only come onto your branch if it has no uncommitted changes. Commit or stash your changes before you run `flows plan`. If you change the `slice` skill, commit it, or the workflow refuses to start.

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

  // The plan agent works in a worktree of its own. A retry throws away uncommitted changes, and that
  // never touches your checkout. Its tickets come onto the branch you're on now.
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

  // Activities: the tickets come onto your branch, and the worktree goes
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

### 4. Ask how far it is

Press `Ctrl+C` in terminal 3. That only stops the waiting: the workflow runs on the server, and the web UI still shows it as **Running**. Ask it how far it is:

```bash
flows status
```

That's a **query**. The answer shows the step, `planning`, from `status` in the code above.

Run `flows plan` again with the same request. It doesn't start a second workflow, it waits for the one that's already running.

### 5. Stop the worker

While the plan agent is still working (terminal 2 shows its output), stop the worker in terminal 2 with `Ctrl+C`. Then start it again:

```bash
flows worker
```

The workflow continues where it stopped. `addWorktree` and `listTickets` don't run again, their results are already in the history. Only the agent run starts again, about 30 seconds later: that's the retry delay set for `runAgent`.

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

When the workflow is done, terminal 3 prints the tickets the plan agent wrote. Open them in `backlog/` and check them as you did in Lab 8: does every ticket cut a full vertical slice, and does every `ready` ticket really not depend on another one?

You now have a server, a worker and a workflow that survives its worker. In the next lab, a workflow changes code.
