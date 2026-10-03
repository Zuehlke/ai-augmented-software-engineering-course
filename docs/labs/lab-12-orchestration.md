# Lab 12 · Orchestration

## Context

In the last lab, you picked the tickets, created the worktrees, started every Ralph loop and checked every branch yourself. Now one workflow, `pipeline`, does all of that, with a role for each step:

| Role | What it does |
| --- | --- |
| **Planner** | A read-only agent picks the tickets that are safe to hand to unattended agents. |
| **Implementers** | One Ralph loop per ticket, each in its own worktree, all at the same time. |
| **Reviewer** | A fresh, read-only agent reviews every branch, with no memory of how it was built. |
| **Merger** | Merges the approved branches into a new branch `integration` and runs the tests. |

You step in only twice, where a human decision matters:

**Planner** → ✋ *you approve the picks* → **Implementers** → **Reviewer** → ✋ *you decide whether to merge* → **Merger**

Two new Temporal terms make that work:

| Term | What it means |
| --- | --- |
| **Signal** | A message to a running workflow. Here, it carries your decision. The workflow waits for it, which costs nothing and survives restarts, so you can decide after a minute or the next morning. |
| **Child workflow** | A workflow started by another workflow. Each implementer is the `ralph` workflow from the Ralph loop lab, started by `pipeline`. |

## Your Task

Start the lab setup with the following command:

```bash
task lab/orchestration
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/orchestration`.
>
> [![Open Lab 12 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Forchestration)

The dashboard has grown: TICKET-1 to TICKET-3 are `done`, TICKET-4 is still `blocked`, and two new tickets are `ready`. The Planner and Reviewer prompts are in `.harness/prompts/`, the `pipeline` workflow in `.harness/flows/src/workflows/pipeline.ts`.

<details>
<summary>New tickets in <code>backlog/</code></summary>

```markdown
---
id: TICKET-5
status: ready
---

# Delayed flights per airport

On the dashboard, support staff can enter an airport code and see which flights departing from it
are currently delayed, and by how many minutes.

## Acceptance Criteria

- The dashboard page shows a search box for an airport code.
- Submitting an airport code lists its currently delayed departing flights with their delay in
  minutes.
- An airport with no delayed flights shows "No delayed flights" instead of an empty list.
- An airport code without any flights shows a clear "not found" message.
```

```markdown
---
id: TICKET-6
status: ready
---

# Airline delay ranking

The dashboard shows which airlines currently have the most delayed flights, without any search.

## Acceptance Criteria

- The dashboard page shows the top 5 airlines by number of currently delayed flights, with name
  and count, highest first.
- Airlines without delayed flights are not listed.
- The ranking is computed from real flight data, not hand-entered values.
```

</details>

<details>
<summary><code>.harness/prompts/planner.md</code> and <code>.harness/prompts/reviewer.md</code></summary>

```markdown
# Planner

Read every ticket in `backlog/`. Pick the tickets that are `ready` and safe to hand to an
unattended agent: clear acceptance criteria, nothing destructive, no ordering requirement between
them. Never pick a `blocked` or `done` ticket.

Print one line per picked ticket, `PICK: <ticket id>`, without any formatting. Then print which
tickets you left out and why. Don't change any file.
```

```markdown
# Reviewer

You review branches built by other agents. You don't know how they were built, review them like a
stranger's pull request. The changes of every branch are below, under `BRANCH <name>`. For every
branch:

1. Check its changes against the ticket in `backlog/` (the ticket id is in the branch name): is every
   acceptance criterion met, and nothing outside its scope changed? A `.harness/progress.md` on the
   branch means the loop didn't finish.
2. Check that tests cover the acceptance criteria. The loop already ran them green, you don't need
   to run them.

End with one line per branch, without any formatting: `<branch>: APPROVE` or
`<branch>: REJECT, <reason>`. Don't change any file.
```

</details>

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

In **terminal 1**, start the Temporal server:

```bash
temporal server start-dev --db-filename ~/temporal.db
```

In **terminal 2**, start the worker. The agent output shows up there:

```bash
flows worker
```

Use **terminal 3** for the steps below. Set `AGENT=copilot` there first if you use GitHub Copilot CLI, the default is Claude Code.

### 1. Run the Planner and approve its picks

```bash
flows plan
```

This starts the `pipeline` workflow. Its first part:

::: code-group

```ts [.harness/flows/src/workflows/pipeline.ts]
// What `flows status` shows
export const pipelineStatus = defineQuery<PipelineStatus>('status');
// Your decisions at the two checkpoints: `flows plan` sends the first, `flows merge` the second
export const approvePicks = defineSignal<[string[]]>('approvePicks');
export const decideMerge = defineSignal<[boolean]>('decideMerge');

// Planner → you approve the picks → one Ralph loop per ticket → Reviewer → you decide → merge
export async function pipeline({ repoDir, agent }: PipelineInput): Promise<PipelineStatus> {
  const status: PipelineStatus = { phase: 'planning', plannerOutput: '', picks: [], reviewerOutput: '', approvedBranches: [], merged: [], conflicts: [] };
  let approved: string[] | undefined;
  let merge: boolean | undefined;
  setHandler(pipelineStatus, () => status);
  setHandler(approvePicks, (tickets) => void (approved = tickets));
  setHandler(decideMerge, (yes) => void (merge = yes));

  // Planner: a read-only agent picks the tickets
  status.plannerOutput = await runAgent({ repoDir, agent, mode: 'read', prompt: await readHarnessFile(repoDir, 'prompts/planner.md') });
  status.picks = captures(status.plannerOutput, /^PICK: (TICKET-\d+)/);

  // Checkpoint 1: waits until `flows plan` sends the picks you approved
  status.phase = 'waiting for your approval';
  await condition(() => approved !== undefined);
```

:::

The Planner runs read-only (`mode: 'read'`) and prints one `PICK:` line per ticket. It should pick TICKET-5 and TICKET-6, and leave out TICKET-4 because it's blocked.

Then the workflow waits in `condition(...)`. `flows plan` asks you about each pick: is it really safe to hand to an unattended agent? Answer `y` for both. `flows plan` sends your answers as the `approvePicks` signal, the signal handler sets `approved`, and the workflow continues.

### 2. Wait for the implementers and the Reviewer

```bash
flows merge
```

`flows merge` waits until the Reviewer is done. Meanwhile, the pipeline runs on by itself:

::: code-group

```ts [.harness/flows/src/workflows/pipeline.ts]
  // Implementers: one Ralph loop per ticket, each in its own worktree, all at the same time
  status.phase = 'implementing';
  const base = await headCommit(repoDir);
  const branches = approved!.map((ticket) => `agent/${ticket.toLowerCase()}`);
  await Promise.all(
    approved!.map(async (ticket, i) => {
      const worktree = await addWorktree(repoDir, ticket.toLowerCase(), branches[i], base);
      await executeChild(ralph, { workflowId: `pipeline-${ticket}`, args: [{ repoDir: worktree, agent, ticket }] });
    }),
  );

  // Reviewer: a fresh, read-only agent gets every branch's changes
  status.phase = 'reviewing';
  const reviewer = await readHarnessFile(repoDir, 'prompts/reviewer.md');
  status.reviewerOutput = await runAgent({ repoDir, agent, mode: 'read', prompt: reviewer + (await branchDiffs(repoDir, branches)) });
  status.approvedBranches = branches.filter((branch) => status.reviewerOutput.includes(`${branch}: APPROVE`));
```

:::

When both loops are done, the Reviewer gets the changes of both branches (`branchDiffs`). It's a new agent process, so it knows nothing about how the branches were built. That's what makes its review worth something.

The implementers take a while. To check on them from another terminal, run `flows status`.

### 3. Decide whether to merge

Once the Reviewer is done, `flows merge` prints its verdict and asks you: do you trust it enough to merge? Answer `y`. That's the `decideMerge` signal, and the last part of the workflow runs:

::: code-group

```ts [.harness/flows/src/workflows/pipeline.ts]
  // Checkpoint 2: waits until `flows merge` sends your decision
  status.phase = 'waiting for your merge decision';
  await condition(() => merge !== undefined);
  if (!merge) {
    status.phase = 'done';
    return status;
  }

  // Merger: merges the approved branches into a new local branch `integration`, never into main
  status.phase = 'merging';
  const integration = await addWorktree(repoDir, 'integration', 'integration', base);
  for (const branch of status.approvedBranches) {
    if (await mergeBranch(integration, branch)) {
      status.merged.push(branch);
    } else {
      status.conflicts.push(branch); // it conflicts with a branch merged before it, so it's left out
    }
  }
  status.testsPass = (await runTests(integration)).pass;
  status.phase = 'done';
  return status;
}
```

:::

The workflow merges only the branches the Reviewer approved, into a new branch `integration` in its own worktree, `.harness/worktrees/integration`. Your checkout and `main` stay untouched. Then it runs the tests on the result.

Both tickets change the same dashboard page, so the second merge will probably conflict, just as it would for two developers. The workflow doesn't try to fix that: the conflicting branch is left out, and `flows merge` reports it. In a real pipeline, that ticket would get another Ralph loop, started from `integration`, so the agent builds on top of the first ticket instead of next to it.

> [!NOTE]
> This exercise's `main` also backs the live course site, so the pipeline never merges into `main` and never pushes. `integration` is where a pull request would start.

### 4. Look at the result

```bash
cd .harness/worktrees/integration
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. Every branch that was merged is on the page.

### 5. Clean up

Stop the app (`Ctrl+C`), go back to the repository root (`cd ../../..`), and remove everything the pipeline created:

```bash
flows cleanup
```

It stops the `pipeline` workflow if it's still running, removes every worktree under `.harness/worktrees/`, and deletes the `agent/*` and `integration` branches. After that, you can run the pipeline again from `flows plan`.
