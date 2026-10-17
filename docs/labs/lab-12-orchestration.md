# Lab 12 · Orchestration

## Context

In the last lab, you started each Ralph loop and checked each branch yourself. In this lab, one workflow called `pipeline` does all of that. You give it a feature request:

<FlowsWatch scene="lab12-overview" />

- Agents do the steps that need judgement. Steps that follow a fixed rule, like picking the `ready` tickets or merging, are plain code.
- The research agent, the plan agent and the implement loops all run through `runPhase` from the Ralph loop. So each of them has a judge, with the `judge` skill's checks for its phase. A bad specification is caught before tickets or code are built on it.
- Each role gets the model that fits it, set in `MODELS` in `src/shared.ts`. The roles that run once and shape everything after them, research, plan and review, get Opus. The implement loops run most often, so they get the cheaper Sonnet. The judge is Opus too: it should be at least as strong as the agent it checks. With `AGENT=copilot`, the roles use Copilot's own model ids, `claude-opus-5` and `claude-sonnet-5`.
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

In **terminal 1**, start Temporal and the worker in the background, and open the pipeline view. The agents use Claude Code. If you use GitHub Copilot CLI, press `a` in `flows watch` to switch to it.

```bash
task flows:start
task flows:watch
```

It shows the pipeline as in the recording above. Blue is what runs, purple is what waits for you. Use **terminal 2** for everything else. `flows logs` there shows the agent output.

### 1. Start the pipeline

<FlowsWatch scene="lab12-start" />

In `flows watch`, the **Specification** stage is selected. Press `Enter`, paste the feature request and press `Enter` again:

<details>
<summary>The feature request</summary>

```text
On the dashboard, support staff enter an airport code and see the delayed flights departing from it, with their delay. The dashboard also shows the airlines with the most delayed flights right now, without any search.
```

</details>

The research agent writes a specification and the plan agent writes tickets. They work in a worktree of their own, like the implement loops later, so they only see what's committed and never touch your checkout. If you changed a skill, commit it first, or the pipeline refuses to start. When the plan agent's judge says `PASS`, the specification and the tickets come onto your current branch. This takes a few minutes. `flows watch` shows which agent works and when its judge checks the result.

### 2. Approve the tickets

<FlowsWatch scene="lab12-approve" />

When the plan agent is done, `flows watch` shows that the tickets wait for you. Before you answer, read what the agents wrote:

- In `specs/`: do the assumptions make sense?
- In `backlog/`: is each `ready` ticket really independent of the others?

Press `n` to open it, select each ticket an agent should build with `Space` and press `Enter`. Only those get a Ralph loop.

The tickets on offer are the `ready` ones, and the `blocked` ones whose `blocked_by` tickets are already done, from an earlier pipeline. A ticket that waits for another ticket of this pipeline, or for something outside the repo (`blocked_reason`), doesn't start: `flows status pipeline` lists it as unfinished, and a later pipeline picks it up.

### 3. Wait for the implement loops and the review agent

<FlowsWatch scene="lab12-implement" />

The implement loops and the review agent take a while. A loop that fails or runs out of runs doesn't stop the others: only the finished tickets go on to review. Press `Tab` to see the Ralph loops move across the backlog board, and `Tab` again to get back to the pipeline. On the board, select a card with the arrow keys and press `Enter` to read its ticket. In the pipeline view, `↑` and `↓` scroll the agents' output, and `End` follows the new lines again. Use the time to read the workflow below. Look for the two checkpoints. Each one is a `condition(...)` that waits for your answer. `flows watch` sends your answer as the same signal as `flows start` and `flows merge` do. Leave out `unattended` and `acceptance` for now: they are for the evals in [Lab 13](./lab-13-evals.md), where nobody approves or decides, so the pipeline takes every ticket it can start and merges what the review approved.

::: code-group

```ts [.harness/src/workflows/pipeline.ts]
import { ApplicationFailure, condition, executeChild, setHandler, workflowInfo } from '@temporalio/workflow';
import { branchOf, MODELS, worktreeName } from '../shared';
import type { PipelineInput, PipelineStatus } from '../types/pipeline';
import { addWorktree, blockedTickets, branchDiffs, checkoutProblem, currentBranch, headCommit, mergeBranch, readyTickets, requireCommitted, removeWorktree, runAgent, runTests } from './activities';
import { failureMessage } from './failure';
import { runPhase } from './phase';
import { reviewPrompt, skillFile } from './prompts';
import { ralph } from './ralph';
import { approveTicketsSignal, decideMergeSignal, pipelineStatus } from './signals';
import { findVerdict } from './text';
import { add, count, keepingUsage, usageOf } from './usage';

// research → plan → dispatch → you approve the tickets → implement, one Ralph loop per ticket → review → you decide → merge
export async function pipeline(input: PipelineInput): Promise<PipelineStatus> {
  const status: PipelineStatus = { step: 'researching', tickets: [], unfinished: [], review: '', approvedBranches: [], merged: [], notMerged: [] };
  const decisions: { approved?: string[]; merge?: boolean } = {}; // as the signals set them
  setHandler(pipelineStatus, () => status);
  setHandler(approveTicketsSignal, (tickets) => void (decisions.approved = tickets));
  setHandler(decideMergeSignal, (yes) => {
    decisions.merge = yes;
    status.mergeProblem = undefined;
  });
  return keepingUsage(status, () => steps(input, status, decisions));
}

async function steps({ repoDir, agent, request, unattended, acceptance }: PipelineInput, status: PipelineStatus, decisions: { approved?: string[]; merge?: boolean }): Promise<PipelineStatus> {
  // Everything it brings comes onto the branch you start it on
  const into = await currentBranch(repoDir);
  status.into = into;

  // The research and the plan agent work in a worktree of their own, like the implement loops. A retry
  // throws away uncommitted changes, and that never touches your checkout.
  const planName = `pipeline-${workflowInfo().runId.slice(0, 8)}`;
  const planBranch = `agent/${planName}`;
  const planDir = await addWorktree(repoDir, planName, planBranch, await headCommit(repoDir));

  // research: an agent writes the specification, and a judge checks it
  await runPhase(repoDir, planDir, agent, {
    name: 'research', // the research skill, checked with the judge skill
    input: `Feature request: ${request}`,
    maxRuns: 3,
    unattended,
  }, status);

  // plan: an agent writes the tickets, and a judge checks them
  status.step = 'planning';
  await runPhase(repoDir, planDir, agent, {
    name: 'plan', // the plan skill, checked with the judge skill
    input: 'Specification: the one the research agent just wrote in specs/',
    maxRuns: 3,
    unattended,
  }, status);

  // The specification and the tickets come onto your branch, so you can read them before you approve
  const problem = await mergeBranch(repoDir, planBranch, into);
  if (problem) {
    throw ApplicationFailure.nonRetryable(`The specification and the tickets are on ${planBranch}, not on ${into}: ${problem}. Run flows cleanup and start again.`);
  }
  await removeWorktree(repoDir, planName, planBranch);

  // dispatch: no agent, a rule. It picks the tickets that can start: `ready`, or blocked only by tickets that are done
  // already. A ticket that waits for a ticket of this pipeline waits for a later pipeline.
  status.tickets = await readyTickets(repoDir);

  // ✋ Checkpoint 1: waits until `flows start` sends the tickets you approved. Unattended, all of them.
  let approved = status.tickets;
  if (!unattended) {
    status.step = 'waiting for your approval';
    await condition(() => decisions.approved !== undefined);
    approved = decisions.approved!;
  }

  // implement: one Ralph loop per ticket, each in its own worktree, all at the same time, all from the same
  // commit. A loop that fails doesn't stop the others: only the finished tickets go on to review. The loops
  // are named after the pipeline, pipeline-TICKET-5, so pipelines that run at the same time, in the evals, don't collide.
  status.step = 'implementing';
  const base = await headCommit(repoDir);
  const loops = approved.map((ticket) => {
    const workflowId = `${workflowInfo().workflowId}-${ticket}`;
    return executeChild(ralph, { workflowId, args: [{ repoDir, agent, ticket, base, unattended, acceptance }] });
  });
  const results = await Promise.allSettled(loops);
  const finished: string[] = [];
  results.forEach((result, i) => {
    const ticket = approved[i];
    add(status, result.status === 'fulfilled' ? result.value : usageOf(result.reason)); // a failed loop's runs cost too
    if (result.status === 'fulfilled' && result.value.done) finished.push(ticket);
    else if (result.status === 'fulfilled') status.unfinished.push(`${ticket}: out of runs, not done`);
    else status.unfinished.push(`${ticket}: ${failureMessage(result.reason)}`);
  });
  if (!finished.length) return finish(repoDir, status);

  // review: a fresh, read-only agent gets every finished branch's changes. Its verdict per branch is its last
  // line about it: `agent/ticket-5: APPROVE` or `agent/ticket-5: REJECT: <why>`. A rejected branch isn't merged.
  const branches = finished.map(branchOf);
  await requireCommitted(repoDir, skillFile('review'));
  await requireCommitted(repoDir, skillFile('change-quality'));
  status.step = 'reviewing';
  const prompt = reviewPrompt(await branchDiffs(repoDir, branches));
  const run = await runAgent({ repoDir, agent, mode: 'read', model: MODELS.review, step: 'review', prompt });
  status.review = count(status, 'review', run);
  const approves = (branch: string) => findVerdict(status.review, ['APPROVE', 'REJECT'], branch)?.kind === 'APPROVE';
  status.approvedBranches = branches.filter(approves);

  // ✋ Checkpoint 2: waits until `flows merge` sends your decision. If your checkout can't take the merge
  // right now, for example because of uncommitted changes, it says why and waits for your decision again.
  // Unattended, it merges what the review approved. Nobody would fix a checkout that can't take it.
  if (unattended) {
    const problem = await checkoutProblem(repoDir, into);
    if (problem) throw ApplicationFailure.nonRetryable(`It can't merge: ${problem}`);
  }
  while (!unattended) {
    status.step = 'waiting for your merge decision';
    await condition(() => decisions.merge !== undefined);
    if (!decisions.merge) return finish(repoDir, status);
    status.mergeProblem = (await checkoutProblem(repoDir, into)) ?? undefined;
    if (!status.mergeProblem) break;
    decisions.merge = undefined; // your checkout couldn't take the merge: wait for your decision again
  }

  // merge: rebases the approved branches onto your branch and fast-forwards it, one after the other.
  // A merged branch's worktree goes. The others stay, so you can look at them.
  status.step = 'merging';
  for (const ticket of finished) {
    const branch = branchOf(ticket);
    if (!status.approvedBranches.includes(branch)) continue;
    const why = await mergeBranch(repoDir, branch, into);
    if (why) {
      status.notMerged.push(`${branch}: ${why}`); // for example, it conflicts with a branch merged before it
    } else {
      status.merged.push(branch);
      await removeWorktree(repoDir, worktreeName(ticket), branch);
    }
  }
  return finish(repoDir, status);
}

// The tickets that never got to start, because what blocks them wasn't merged, and the tests of what was merged
async function finish(repoDir: string, status: PipelineStatus): Promise<PipelineStatus> {
  status.unfinished.push(...(await blockedTickets(repoDir, status.tickets)));
  if (status.merged.length) status.testsPass = (await runTests(repoDir)).pass;
  status.step = 'done';
  return status;
}
```

:::

<details>
<summary>The skills in <code>.agents/skills/</code> and <code>prompts.ts</code> (already in the branch)</summary>

The `research` and `plan` skills usually ask you questions. In the pipeline, nobody is there to answer. So `workPrompt` in `prompts.ts` tells every agent to make a sensible assumption and write it down where the skill keeps assumptions. The judges check these first, and then you check them at the first checkpoint.

::: code-group

```ts [.harness/src/workflows/prompts.ts (excerpt)]
// What the harness tells each agent. The work itself is in the skills, .agents/skills/<name>/SKILL.md, the
// same skills you use yourself in the earlier labs. This only adds what's different when nobody watches.
import type { PhaseName } from '../types/pipeline';

// Where an agent finds a skill, in its worktree
export const skillFile = (name: string) => `.agents/skills/${name}/SKILL.md`;

// An agent that does the work, unattended
export function workPrompt(skill: PhaseName, input: string): string {
  return `Use the ${skill} skill in \`${skillFile(skill)}\` for the input below.

You run unattended: nobody answers questions or approves anything. Where the skill tells you to ask or to
wait for approval, make a sensible assumption, write it down where the skill keeps assumptions, and go on.
If \`.harness/run/feedback.md\` exists, the judge rejected your last run: fix what it says first.
Commit your work.

${input}`;
}

// The judge of a phase: it gets the same input as the agent, and the agent's commits
export function judgePrompt(phase: PhaseName, input: string, commits: string): string {
  return `Use the judge skill in \`${skillFile('judge')}\` to judge this ${phase} run.

${input}

${commits}`;
}

// The review agent of the pipeline: it gets every branch's changes, and decides which ones to merge
export function reviewPrompt(diffs: string): string {
  return `Use the review skill in \`${skillFile('review')}\` on the branches below.${diffs}`;
}

```

```markdown [.agents/skills/judge/SKILL.md (excerpt)]
---
name: judge
description: Judge another agent's run on a phase (research, plan or implement) like a stranger's work, and end with one verdict line.
disable-model-invocation: true
---

## TASK

Another agent just did a run on the phase named below, for the input below. Its commits are at the
end. Judge them like a stranger's work. Read any file you need, but don't change any.

---

## CHECKS

Use the checks of the phase you judge.

### research

The agent turned the feature request into a specification in `specs/`.

- Every part of the feature request is covered, and nothing beyond it is added.
- Where the request leaves something open, there is a sensible assumption under Assumptions.
- No assumption or criterion changes a value the request defines (rounding, truncation, clamping,
  defaults). One that does is scope added beyond the request.
- If the request can be read in two ways that lead to different features, ask a question instead.

### plan

The agent turned the specification into tickets in `backlog/`.

- Every ticket is a vertical slice that a user can see or use, not a layer such as "database" or "UI".
- A `ready` ticket doesn't depend on any other new ticket. One that does is `blocked`, with those
  tickets in `blocked_by`.
- Together, the tickets cover the whole specification.
- Every acceptance criterion of the specification is owned by exactly one ticket. A ticket that only
  combines what another ticket built, for example "X together with Y", or that only adds tests for
  another ticket's behaviour, is not a slice: its criteria belong to the ticket that builds the
  behaviour. A small request is one ticket.

…

---

## VERDICT

End with exactly one line, without any formatting: `PASS`, `RETRYABLE: <what to fix>`,
`AMBIGUOUS: <question for a human>` or `FAILED: <why no further attempt can fix it>`.
```

```markdown [.agents/skills/review/SKILL.md]
---
name: review
description: Review a finished change built by other agents like a stranger's pull request, against its tickets in backlog/ or against a feature request and hidden criteria, and end with APPROVE or REJECT.
disable-model-invocation: true
---

## TASK

You review a change built by other agents. You don't know how it was built: review it like a stranger's
pull request. Read any file you need, but don't change any. You get one of two inputs:

- **Branches**, each under `BRANCH <name>`: the pipeline asks whether to merge them. Every branch is
  checked against its ticket in `backlog/`, the ticket id is in the branch name.
- **One change**, with a FEATURE REQUEST and CRITERIA: the evals ask whether you would ship it. The
  agents that built it never saw the criteria. What they left besides the code, a specification in
  `specs/` and tickets in `backlog/`, is fine.

---

## STEPS

For every branch, or for the one change:

1. Check it against what was asked. Every acceptance criterion of the ticket, or every one of the
   CRITERIA, is met by the change itself, not only by its tests, and nothing outside its scope changed.
   A `.harness/progress.md` on a branch means the loop didn't finish.

2. Check it against the checklist in `.agents/skills/change-quality/SKILL.md`. The tests already ran
   green, you don't need to run them. An item that doesn't hold is a reason to REJECT: say which.

---

## VERDICT

End without any formatting, no bullets, no bold, no backticks:

- For branches, one line per branch: `<branch>: APPROVE` or `<branch>: REJECT: <reason>`. Every branch
  gets exactly one such line, the last lines of your answer. A branch without one counts as rejected.
- For one change, exactly one line: `APPROVE` or `REJECT: <the most important reason>`.
```

:::

</details>

### 4. Decide whether to merge

<FlowsWatch scene="lab12-merge" />

When the review agent is done, `flows watch` shows that the merge decision waits for you. Press `n` to see the review agent's verdict for each branch.

To check a branch's changes yourself before you decide, press `Esc` and `Tab` to the board. The finished tickets wait under **Needs you** as *ready to merge*. Open one with `Enter` and press `d`: VS Code shows what its branch changes, one side-by-side diff per file. Press `Esc`, `Tab` back to the pipeline and press `n` to open the merge decision again.

Press `y`. The workflow rebases each approved branch onto your branch and fast-forwards it, one after the other, so there's no merge commit. Then it runs the tests. If your checkout has uncommitted changes, it says so and waits for your decision again.

Both tickets change the same dashboard page, so the second branch will probably conflict when it's rebased. The workflow doesn't merge that branch. It stays on the board as *ready to merge*: open it with `Enter` and press `m` to see its commits and the command to rebase it by hand. If a branch applies cleanly, `y` there rebases and fast-forwards it. In terminal 2, see which branches were merged, which weren't and why, whether the tests pass, what the agent runs cost, and which model each role ran with:

```bash
flows status pipeline
```

### 5. Look at the result

In terminal 2:

```bash
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. You should see the work of every merged branch.

### 6. Clean up

Stop the app (`Ctrl+C`), quit `flows watch` (`q`) and clean up:

```bash
flows cleanup
```

This stops any workflow still running, removes the worktrees and deletes the merged `agent/*` branches. A branch that isn't merged, like the conflicting one, stays: `flows cleanup` prints how to look at it or delete it. The specification, the tickets and the merged code stay on your branch.
