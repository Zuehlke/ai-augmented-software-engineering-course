# Lab 12 · Orchestration

## Context

In the last lab, you started each Ralph loop and checked each branch yourself. In this lab, one workflow called `pipeline` does all of that. You give it a feature request:

<PipelineDiagram />

- Agents do the steps that need judgement. Steps that follow a fixed rule, like picking the `ready` tickets or merging, are plain code.
- The Researcher, the Planner and the implementers all run through `runPhase` from the Ralph loop. So each of them has a judge with its own checklist. A bad specification is caught before tickets or code are built on it.
- You only step in twice, at the two human gateways.

## Your Task

Start the lab setup with the following command:

```bash
task lab/orchestration
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/orchestration`.
>
> [![Open Lab 12 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Forchestration)

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

In **terminal 1**, start the Temporal server:

```bash
temporal server start-dev --db-filename ~/temporal.db
```

In **terminal 2**, start the worker. It shows the agent output:

```bash
flows worker
```

Use **terminal 3** for the steps below. If you use GitHub Copilot CLI, set `AGENT=copilot` there first. The default is Claude Code.

### 1. Start the pipeline

<PipelineDiagram :step="1" />

Start the pipeline with a feature request:

```bash
flows start "<feature request>"
```

<details>
<summary>The feature request</summary>

```text
On the dashboard, support staff enter an airport code and see the delayed flights departing from
it, with their delay. The dashboard also shows the airlines with the most delayed flights right
now, without any search.
```

</details>

The Researcher writes a specification and the Planner writes tickets, both on your current branch. This takes a few minutes. Terminal 2 shows what the agents and judges do.

### 2. Approve the tickets

<PipelineDiagram :step="2" />

Next, `flows start` asks you about each `ready` ticket. Before you answer, read what the agents wrote:

- In `specs/`: do the assumptions make sense?
- In `backlog/`: is each `ready` ticket really independent of the others?

Answer `y` for each ticket an agent should build. Only those get a Ralph loop.

### 3. Wait for the implementers and the Reviewer

<PipelineDiagram :step="3" />

```bash
flows merge
```

`flows merge` waits until the Reviewer is done, which takes a while. Use the time to read the workflow below. Look for the two checkpoints. Each one is a `condition(...)` that waits for your answer.

::: code-group

```ts [.harness/flows/src/workflows/pipeline.ts]
import { condition, defineQuery, defineSignal, executeChild, setHandler } from '@temporalio/workflow';
import type { PipelineInput, PipelineStatus } from '../shared';
import { addWorktree, branchDiffs, headCommit, mergeBranch, readHarnessFile, readyTickets, runAgent, runTests } from './activities';
import { runPhase } from './phase';
import { ralph } from './ralph';

// What `flows status` shows
export const pipelineStatus = defineQuery<PipelineStatus>('status');
// Your decisions at the two checkpoints: `flows start` sends the first, `flows merge` the second
export const approveTickets = defineSignal<[string[]]>('approveTickets');
export const decideMerge = defineSignal<[boolean]>('decideMerge');

export async function pipeline({ repoDir, agent, request }: PipelineInput): Promise<PipelineStatus> {
  const status: PipelineStatus = { phase: 'researching', tickets: [], reviewerOutput: '', approvedBranches: [], merged: [], conflicts: [] };
  let approved: string[] | undefined;
  let merge: boolean | undefined;
  setHandler(pipelineStatus, () => status);
  setHandler(approveTickets, (tickets) => void (approved = tickets));
  setHandler(decideMerge, (yes) => void (merge = yes));

  // Researcher: an agent writes the specification, and a judge checks it
  await runPhase(repoDir, agent, {
    name: 'research', // prompts/research.md and prompts/judge-research.md
    input: `Feature request: ${request}`,
    maxAttempts: 3,
  }, status);

  // Planner: an agent writes the tickets, and a judge checks them
  status.phase = 'planning';
  await runPhase(repoDir, agent, {
    name: 'slice', // prompts/slice.md and prompts/judge-slice.md
    input: 'Specification: the one the Researcher just wrote in specs/',
    maxAttempts: 3,
  }, status);

  // Dispatcher: no agent, a rule. It picks the tickets marked `ready`.
  status.tickets = await readyTickets(repoDir);

  // Checkpoint 1: waits until `flows start` sends the tickets you approved
  status.phase = 'waiting for your approval';
  await condition(() => approved !== undefined);

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

  // Checkpoint 2: waits until `flows merge` sends your decision
  status.phase = 'waiting for your merge decision';
  await condition(() => merge !== undefined);
  if (!merge) {
    status.phase = 'done';
    return status;
  }

  // Merger: merges the approved branches into the branch you're on
  status.phase = 'merging';
  for (const branch of status.approvedBranches) {
    if (await mergeBranch(repoDir, branch)) {
      status.merged.push(branch);
    } else {
      status.conflicts.push(branch); // it conflicts with a branch merged before it, so it's left out
    }
  }
  status.testsPass = (await runTests(repoDir)).pass;
  status.phase = 'done';
  return status;
}
```

:::

<details>
<summary>The prompts in <code>.harness/prompts/</code> (already in the branch)</summary>

The `research` and `slice` skills usually ask you questions. In the pipeline, nobody is there to answer. So the prompts tell the agents to make their own decisions and write down their assumptions. The judges check these first, and then you check them at the first checkpoint.

```markdown
# Research

Follow the research skill in `.agents/skills/research/SKILL.md` for the feature request below. You
run unattended: don't ask questions and don't wait for feedback. Where the skill tells you to ask,
make a sensible assumption and write it under Assumptions. If `.harness/feedback.md` exists, fix
what it says first. Commit the specification. Don't change any code.
```

```markdown
# Judge: research

Another agent just turned the feature request below into a specification in `specs/`. Judge it
like a stranger's work. Read any file you need, but don't change any.

- Every part of the feature request is covered, and nothing beyond it is added.
- Where the request leaves something open, there is a sensible assumption under Assumptions.
- If the request can be read in two ways that lead to different features, ask a question instead.

End with exactly one line, without any formatting: `PASS`, `RETRYABLE: <what to fix>`,
`AMBIGUOUS: <question for a human>` or `FAILED: <why no further attempt can fix it>`.
```

```markdown
# Slice

Follow the slice skill in `.agents/skills/slice/SKILL.md` for the input below. You run unattended:
skip the approval step and write the tickets right away. Number them after the highest ticket
already in `backlog/`, and don't change the existing tickets. If `.harness/feedback.md` exists,
fix what it says first. Commit the tickets. Don't change any code.
```

```markdown
# Judge: slice

Another agent just turned the specification below into tickets in `backlog/`. Judge them like a
stranger's work. Read any file you need, but don't change any.

- Every ticket is a vertical slice that a user can see or use, not a layer such as "database" or "UI".
- A `ready` ticket doesn't depend on any other new ticket. One that does is `blocked`.
- Together, the tickets cover the whole specification.

End with exactly one line, without any formatting: `PASS`, `RETRYABLE: <what to fix>`,
`AMBIGUOUS: <question for a human>` or `FAILED: <why no further attempt can fix it>`.
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

### 4. Decide whether to merge

<PipelineDiagram :step="4" />

`flows merge` shows the Reviewer's verdict for each branch and asks whether to merge. Answer `y`. The workflow merges the approved branches into your branch and runs the tests.

Both tickets change the same dashboard page, so the second merge will probably conflict. The workflow skips that branch and `flows merge` tells you about it.

### 5. Look at the result

```bash
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. You should see the work of every merged branch.

### 6. Clean up

Stop the app (`Ctrl+C`) and clean up:

```bash
flows cleanup
```

This deletes the implementers' worktrees and `agent/*` branches. The specification, the tickets and the merged code stay on your branch.
