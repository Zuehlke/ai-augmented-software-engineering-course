# Lab 12 · Orchestration

## Context

In this lab, we will run the whole pipeline:

<FlowsWatch scene="lab12-overview" />

- Agents do the steps that need judgement. Fixed rules, like picking `ready` tickets or merging, are plain code.
- Research, plan and implement all work like the Ralph loop: an agent runs, a judge checks it.
- Research, plan, review and the judge run on Opus. The implement loops run most often, so they use the cheaper Sonnet.
- You only step in twice, at the two human gateways, marked with ⚑ in the UI.

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

Start Temporal and the worker in the background, and open the pipeline view. The agents use Claude Code. If you use GitHub Copilot CLI, press `a` in `flows watch` to switch to it.

```bash
task flows:start
task flows:watch
```

It shows the pipeline as in the recording above. Blue is what runs, purple is what waits for you.

### 1. Start the pipeline

<FlowsWatch scene="lab12-start" />

In the UI, the **Specification** stage is selected. Press `Enter`, paste the feature request and press `Enter` again:

<details>
<summary>The feature request</summary>

```text
On the dashboard, support staff enter an airport code and see the delayed flights departing from it, with their delay. The dashboard also shows the airlines with the most delayed flights right now, without any search.
```

</details>

The research agent writes a specification and the plan agent writes tickets. Each phase has its own judge, which checks the result before the next phase starts.

### 2. Approve the tickets

When the plan agent is done, the tickets wait for you. First check what the agents wrote:

- In `specs/`: do the assumptions make sense?
- In `backlog/`: is each `ready` ticket independent of the others?

Then press `n`, select the tickets to build with `Space`, and press `Enter`. Each selected ticket gets a Ralph loop. Only tickets that nothing blocks are on offer.

<FlowsWatch scene="lab12-approve" />

### 3. Wait for the implement loops and the review agent

The implement loops and the review agent take a while. A loop that fails doesn't stop the others: only finished tickets go on to review. Press `Tab` to switch between the pipeline and the board.

<FlowsWatch scene="lab12-implement" />

Meanwhile, read a simplified version of the workflow below. Every step uses something from the earlier labs: agents checked by a judge, one Ralph loop per ticket in its own worktree, and two checkpoints. Each checkpoint is a `condition(...)` that waits for your answer in the UI.

::: code-group

```ts [.harness/src/workflows/pipeline.ts (simplified)]
// research → plan → you approve the tickets → implement → review → you decide → merge
async function steps({ repoDir, agent, request }: PipelineInput, status: PipelineStatus, decisions: Decisions) {
  // research and plan: an agent works, a judge checks it, like in the Ralph loop
  await runPhase(repoDir, planDir, agent, { name: 'research', input: `Feature request: ${request}`, maxRuns: 3 }, status);
  await runPhase(repoDir, planDir, agent, { name: 'plan', input: 'Specification: the one in specs/', maxRuns: 3 }, status);

  // dispatch: no agent, a rule. It picks the tickets that nothing blocks
  status.tickets = await readyTickets(repoDir);

  // ✋ Checkpoint 1: waits until you approve the tickets
  await condition(() => decisions.approved !== undefined);

  // implement: one Ralph loop per ticket, each in its own worktree, all at the same time
  const loops = decisions.approved!.map((ticket) =>
    executeChild(ralph, { workflowId: `pipeline-${ticket}`, args: [{ repoDir, agent, ticket, base }] }));
  const results = await Promise.allSettled(loops); // a loop that fails doesn't stop the others

  // review: a read-only agent checks every finished branch
  status.review = await runAgent({ repoDir, agent, mode: 'read', model: MODELS.review, step: 'review', prompt });

  // ✋ Checkpoint 2: waits for your merge decision
  await condition(() => decisions.merge !== undefined);
  if (!decisions.merge) return finish(repoDir, status);

  // merge: rebases each approved branch onto your branch, one after the other
  for (const branch of status.approvedBranches) await mergeBranch(repoDir, branch, into);
  return finish(repoDir, status);
}
```

:::

<details>
<summary>The skills in <code>.agents/skills/</code> and <code>prompts.ts</code> (already in the branch)</summary>

The `research` and `plan` skills usually ask you questions. In the pipeline, nobody is there to answer. So `workPrompt` in `prompts.ts` tells every agent to make a sensible assumption and write it down where the skill keeps assumptions. The judges check these first, and then you check them at the first checkpoint.

The `judge` skill keeps its checks per phase, in `checks/`. Each judge reads only the file of its phase, which `judgePrompt` names, so a plan judge isn't distracted by the rules for code.

::: code-group

```ts [.harness/src/workflows/prompts.ts (excerpt)]
// What the harness tells each agent. The work itself is in the skills, .agents/skills/<name>/SKILL.md, the
// same skills you use yourself in the earlier labs. This only adds what's different when nobody watches.
import type { PhaseName } from '../types/pipeline';

// Where an agent finds a skill, in its worktree
export const skillFile = (name: string) => `.agents/skills/${name}/SKILL.md`;

// The judge's checks for one phase. The judge reads only these, not the checks of the other phases.
export const judgeChecksFile = (phase: PhaseName) => `.agents/skills/judge/checks/${phase}.md`;

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
  return `Use the judge skill in \`${skillFile('judge')}\` to judge this ${phase} run, with the checks in \`${judgeChecksFile(phase)}\`.

${input}

${commits}`;
}

// The review agent of the pipeline: it gets every branch's changes, and decides which ones to merge
export function reviewPrompt(diffs: string): string {
  return `Use the review skill in \`${skillFile('review')}\` on the branches below.${diffs}`;
}

```

```markdown [.agents/skills/judge/SKILL.md]
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

Read the checks of the phase you judge, and only those: `checks/<phase>.md` next to this file, for
example `checks/implement.md`. The phase is named below.

---

## VERDICT

End with exactly one line, without any formatting: `PASS`, `RETRYABLE: <what to fix>`,
`AMBIGUOUS: <question for a human>` or `FAILED: <why no further attempt can fix it>`.
```

```markdown [.agents/skills/judge/checks/research.md]
# Checks: research

The agent turned the feature request into a specification in `specs/`.

- Every part of the feature request is covered, and nothing beyond it is added.
- Where the request leaves something open, there is a sensible assumption under Assumptions.
- No assumption or criterion changes a value the request defines (rounding, truncation, clamping,
  defaults). One that does is scope added beyond the request.
- If the request can be read in two ways that lead to different features, ask a question instead.
```

```markdown [.agents/skills/judge/checks/plan.md]
# Checks: plan

The agent turned the specification into tickets in `backlog/`.

- Every ticket is a vertical slice that a user can see or use, not a layer such as "database" or "UI".
- A `ready` ticket doesn't depend on any other new ticket. One that does is `blocked`, with those
  tickets in `blocked_by`.
- Together, the tickets cover the whole specification.
- Every acceptance criterion of the specification is owned by exactly one ticket. A ticket that only
  combines what another ticket built, for example "X together with Y", or that only adds tests for
  another ticket's behaviour, is not a slice: its criteria belong to the ticket that builds the
  behaviour. A small request is one ticket.
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

When the review agent is done, the merge decision waits for you. Press `n` to see the review's verdict for each branch. To see a branch's changes yourself, open its ticket on the board and press `d`.

Press `y` to merge. The workflow rebases each approved branch onto your branch, then runs the tests. Both tickets change the same dashboard page, so the second branch may conflict. It then stays on the board as *ready to merge*: open it and press `m` to see how to rebase it by hand.

<FlowsWatch scene="lab12-merge" />

### 5. Look at the result

In a new terminal:

```bash
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. You should see the work of every merged branch.

### 6. Clean up

Stop the app (`Ctrl+C`), quit `flows watch` (`q`) and clean up:

```bash
flows cleanup
```

This stops any running workflows and removes the worktrees and merged branches. Unmerged branches stay, and `flows cleanup` prints how to delete them. Your branch keeps the specification, the tickets and the merged code.
