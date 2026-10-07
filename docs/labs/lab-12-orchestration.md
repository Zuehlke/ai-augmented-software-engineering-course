# Lab 12 · Orchestration

## Context

In the last lab, you started every Ralph loop and checked every branch yourself. Now one workflow, `pipeline`, does it all, starting from a feature request:

**Researcher** → **Planner** → **Dispatcher** → ✋ *you approve the tickets* → **Implementers** → **Reviewer** → ✋ *you decide whether to merge* → **Merger**

| Role | What it does |
| --- | --- |
| **Researcher** | An agent with the `research` skill turns the feature request into a specification. |
| **Planner** | An agent with the `slice` skill turns the specification into tickets, each `ready` or `blocked`. |
| **Dispatcher** | Plain code picks the `ready` tickets. |
| **Implementers** | One Ralph loop per ticket, each in its own worktree, all at the same time. |
| **Reviewer** | A read-only agent reviews every finished branch, with no memory of how it was built. |
| **Merger** | Plain code merges the approved branches and runs the tests. |

Agents do the steps that need judgement, plain code does the ones a rule can decide. You step in only at the two ✋ checkpoints.

## Your Task

Start the lab setup with the following command:

```bash
task lab/orchestration
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/orchestration`.
>
> [![Open Lab 12 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Forchestration)

<details>
<summary><code>.harness/prompts/research.md</code>, <code>slice.md</code> and <code>reviewer.md</code></summary>

The `research` and `slice` skills ask you questions and wait for your approval. In the pipeline, nobody answers, so the prompts tell the agents to decide by themselves and write their assumptions down. You check them at the first checkpoint.

```markdown
# Research

Follow the research skill in `.agents/skills/research/SKILL.md` for the feature request below. You
run unattended: don't ask questions and don't wait for feedback. Where the skill tells you to ask,
make a sensible assumption and write it under Assumptions. Don't change any code.
```

```markdown
# Slice

Follow the slice skill in `.agents/skills/slice/SKILL.md` for the specification the Researcher
just wrote in `specs/`. You run unattended: skip the approval step and write the tickets right
away. Number them after the highest ticket already in `backlog/`, and don't change the existing
tickets. Don't change any code.
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

### 1. Start the pipeline and approve the tickets

Start the pipeline with the feature request:

```bash
flows start "On the dashboard, support staff enter an airport code and see the delayed flights departing from it, with their delay. The dashboard also shows the airlines with the most delayed flights right now, without any search."
```

The pipeline works in a new worktree, `.harness/worktrees/integration`, on a new branch `integration`. Your checkout and `main` stay untouched. The Researcher writes a specification, the Planner writes the tickets, and the Dispatcher picks the ones marked `ready`. That takes a few minutes, and the agent output shows up in terminal 2.

Then `flows start` asks you about each ready ticket: is it safe to hand to an unattended agent? Before you answer, check what the agents wrote in `.harness/worktrees/integration/`:

- `specs/`: are the assumptions in the specification sensible?
- `backlog/`: does every `ready` ticket really not depend on another one?

Answer `y` for the tickets you approve. `flows start` sends your answers to the workflow as a **signal**: a message to a running workflow. The workflow waits for it in `condition(...)`, which costs nothing and survives restarts, so you could also answer the next morning.

The pipeline runs one wave: only the tickets that are `ready` now. If the Planner made one ticket block the others, only that one runs.

Here's the whole workflow. The next steps follow it from `// Implementers` on:

::: code-group

```ts [.harness/flows/src/workflows/pipeline.ts]
import { condition, defineQuery, defineSignal, executeChild, setHandler } from '@temporalio/workflow';
import type { PipelineInput, PipelineStatus } from '../shared';
import { addWorktree, branchDiffs, commitAll, headCommit, mergeBranch, readHarnessFile, readyTickets, runAgent, runTests } from './activities';
import { ralph } from './ralph';

// What `flows status` shows
export const pipelineStatus = defineQuery<PipelineStatus>('status');
// Your decisions at the two checkpoints: `flows start` sends the first, `flows merge` the second
export const approveTickets = defineSignal<[string[]]>('approveTickets');
export const decideMerge = defineSignal<[boolean]>('decideMerge');

// Researcher → Planner → Dispatcher → you approve the tickets → one Ralph loop per ticket → Reviewer → you decide → merge
export async function pipeline({ repoDir, agent, request }: PipelineInput): Promise<PipelineStatus> {
  const status: PipelineStatus = { phase: 'researching', tickets: [], reviewerOutput: '', approvedBranches: [], merged: [], conflicts: [] };
  let approved: string[] | undefined;
  let merge: boolean | undefined;
  setHandler(pipelineStatus, () => status);
  setHandler(approveTickets, (tickets) => void (approved = tickets));
  setHandler(decideMerge, (yes) => void (merge = yes));

  // Everything lands on a new local branch `integration`, in its own worktree, never on main
  const integration = await addWorktree(repoDir, 'integration', 'integration', await headCommit(repoDir));

  // Researcher: an agent turns the feature request into a specification
  const research = await readHarnessFile(repoDir, 'prompts/research.md');
  await runAgent({ repoDir: integration, agent, mode: 'write', prompt: `${research}\nFeature request: ${request}` });

  // Planner: an agent turns the specification into tickets in backlog/
  status.phase = 'planning';
  const slice = await readHarnessFile(repoDir, 'prompts/slice.md');
  await runAgent({ repoDir: integration, agent, mode: 'write', prompt: slice });
  await commitAll(integration, 'Add the specification and its tickets');

  // Dispatcher: no agent, a rule. It picks the tickets marked `ready`.
  status.tickets = await readyTickets(integration);

  // Checkpoint 1: waits until `flows start` sends the tickets you approved
  status.phase = 'waiting for your approval';
  await condition(() => approved !== undefined);

  // Implementers: one Ralph loop per ticket, each in its own worktree, all at the same time
  status.phase = 'implementing';
  const base = await headCommit(integration);
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
  status.reviewerOutput = await runAgent({ repoDir: integration, agent, mode: 'read', prompt: reviewer + (await branchDiffs(integration, branches)) });
  status.approvedBranches = branches.filter((branch) => status.reviewerOutput.includes(`${branch}: APPROVE`));

  // Checkpoint 2: waits until `flows merge` sends your decision
  status.phase = 'waiting for your merge decision';
  await condition(() => merge !== undefined);
  if (!merge) {
    status.phase = 'done';
    return status;
  }

  // Merger: merges the approved branches into `integration`
  status.phase = 'merging';
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

### 2. Wait for the implementers and the Reviewer

```bash
flows merge
```

`flows merge` waits until the Reviewer is done. Meanwhile, the pipeline runs on by itself, through `// Implementers` and `// Reviewer` in the code above. This takes a while. To check on it from another terminal, run `flows status`.

The Reviewer gets the changes of every branch. It's a new agent, so it knows nothing about how they were built. And unlike the step reviewer in each Ralph loop, it sees each finished branch as a whole.

### 3. Decide whether to merge

Once the Reviewer is done, `flows merge` prints its verdict and asks whether to merge. Answer `y`: that's the second signal, `decideMerge`. The workflow merges the approved branches into `integration` and runs the tests.

Both features change the same dashboard page, so the second merge will probably conflict, just as it would for two developers. The workflow leaves the conflicting branch out, and `flows merge` reports it.

### 4. Look at the result

```bash
cd .harness/worktrees/integration
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. Every branch that was merged is on the page.

### 5. Clean up

Stop the app (`Ctrl+C`) and clean up:

```bash
flows cleanup
```

This removes the worktrees and branches the pipeline created, so you can start again.
