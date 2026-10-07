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

In this lab, you run a workflow that doesn't change any code: a read-only agent explains every ticket in the backlog. While it runs, you stop the worker and watch the workflow carry on.

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
AGENT=copilot flows explain-tickets
```

  </template>
  <template #tab2>

```bash
flows explain-tickets
```

  </template>
</ContentTabs>

The workflow gets the ticket ids from `backlog/`, lets an agent explain every ticket, and returns the explanations. Terminal 3 prints them at the end.

::: code-group

```ts [.harness/flows/src/workflows/explain-tickets.ts]
import { defineQuery, log, setHandler } from '@temporalio/workflow';
import type { Agent } from '../shared';
import { listTickets, runAgent } from './activities';

// What `flows status` shows while the workflow runs
export const progress = defineQuery<{ tickets: string[]; explained: string[] }>('status');

// Lets a read-only agent explain every ticket in backlog/, one ticket after the other
export async function explainTickets({ repoDir, agent }: { repoDir: string; agent: Agent }) {
  let tickets: string[] = [];
  const explained: { ticket: string; explanation: string }[] = [];
  setHandler(progress, () => ({ tickets, explained: explained.map((e) => e.ticket) }));

  // Activity: reads the ticket ids from backlog/
  tickets = await listTickets(repoDir);

  for (const ticket of tickets) {
    log.info(`== ${ticket}`);

    // Activity: one agent run. Its answer goes into the workflow's history.
    const answer = await runAgent({
      repoDir,
      agent,
      mode: 'read',
      prompt: `Read ${ticket} in backlog/ and the code it touches. Reply in at most three sentences,
without any formatting: what does the ticket ask for, and which files will it change?`,
    });
    explained.push({ ticket, explanation: answer.trim() });
  }

  return explained;
}
```

:::

The two `await` lines are **activities**: `listTickets` reads `backlog/`, and `runAgent` runs an agent. Temporal saves the result of each activity in the workflow's **history**. The rest of the function only decides what to do next.

If the worker stops, a new worker runs the function again from the top. But it skips every activity that already finished and takes its saved result from the history instead. So the workflow is quickly back where it stopped, and only the unfinished work runs again.

In the web UI, click `explain-tickets` to see its history: `listTickets` completed, then one `runAgent` per ticket.

### 4. Ask how far it is

Press `Ctrl+C` in terminal 3. That only stops the waiting: the workflow runs on the server, and the web UI still shows it as **Running**. Ask it how far it is:

```bash
flows status
```

That's a **query**. The answer lists all tickets and the ones explained so far, from `progress` in the code above.

Run `flows explain-tickets` again. It doesn't start a second workflow, it waits for the one that's already running.

### 5. Stop the worker

When terminal 2 shows `[explain-tickets] == TICKET-2`, stop the worker with `Ctrl+C`. Then start it again:

```bash
flows worker
```

The workflow continues where it stopped. TICKET-1 isn't explained again, its answer is already in the history. Only the agent run for TICKET-2 starts again, about 30 seconds later: that's the retry delay set for `runAgent`.

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

When the workflow is done, terminal 3 prints one explanation per ticket. Compare them with `backlog/`: do they match what the tickets ask for?

You now have a server, a worker and a workflow that survives its worker. In the next lab, a workflow changes code.
