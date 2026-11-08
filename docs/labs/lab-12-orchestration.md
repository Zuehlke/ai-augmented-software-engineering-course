# Lab 12 · Orchestration

## Context

In this lab, we will run the whole pipeline:

<FlowsWatch scene="lab12-overview" />

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

Start Temporal and the worker in the background, and open the pipeline view on [http://localhost:8234](http://localhost:8234). The agents use Claude Code. If you use GitHub Copilot CLI, click **Copilot** next to **Agent** in `flows watch` to switch to it.

```bash
task flows:start
task flows:watch
```

It shows the pipeline as in the screenshots above. Blue is what runs, purple is what waits for you.

### 1. Start the pipeline

<FlowsWatch scene="lab12-start" />

In the UI, click the **Research** box, paste the feature request and click **Start the pipeline**:

<details>
<summary>The feature request</summary>

```text
On the dashboard, support staff enter an airport code and see the delayed flights departing from it, with their delay. The dashboard also shows the airlines with the most delayed flights right now, without any search.
```

</details>

The research agent writes a specification. Each phase has its own judge, which checks the result before the next phase starts.

### 2. Approve the specification

When the research agent is done, the specification waits for you. First check what the agent wrote:

- In `specs/`: do the assumptions make sense?

Then click **Decide**. Click **Approve**, or **Send back…** to send it back: type your feedback and click **Send back**. The research agent revises the specification and asks you again. Once you approve it, the design agent writes the design next to it, and the plan agent writes tasks along the design.

<FlowsWatch scene="lab12-specification" />

### 3. Approve the plan

When the plan agent is done, the design and the tasks wait for you. First check what the agents wrote:

- In `specs/`: does the design fit the specification?
- In `backlog/`: is each `ready` task independent of the others?

Then click **Decide**, select the tasks to build and click **Approve**. Each selected task gets a Ralph loop. Only tasks that nothing blocks are on offer. If the plan isn't right, click **Send back…** instead and type your feedback: its tasks go, and the design and the plan agent do it again.

<FlowsWatch scene="lab12-approve" />

### 4. Wait for the implement loops and the review agent

The implement loops and the review agent take a while. A loop that fails doesn't stop the others: only finished tasks go on to review. The loops are under **Loops**: click one to open its task.

<FlowsWatch scene="lab12-implement" />

Meanwhile, read a simplified version of the workflow below. Every step uses something from the earlier labs: agents checked by a judge, one Ralph loop per task in its own worktree, and three checkpoints. Each checkpoint is a `condition(...)` that waits for your answer in the UI.

::: code-group

```ts [.harness/src/workflows/pipeline.ts (simplified)]
// research → you approve the specification → design → plan → you approve the plan → implement → review →
// you decide → merge. At the first two checkpoints, you can send the work back with your feedback instead.
async function steps({ repoDir, agent, request }: PipelineInput, status: PipelineStatus, decisions: Decisions) {
  // research: an agent works, a judge checks it, like in the Ralph loop
  // ✋ Checkpoint 1: what it wrote comes onto your branch, and it waits until you approve it or send it back
  let feedback: string | undefined;
  do {
    await runPhase(repoDir, planDir, agent, { name: 'research', input: researchInput(request, feedback), maxRuns: 3 }, status);
    feedback = (await checkpoint('specification', 'waiting for your specification approval')).feedback;
  } while (feedback !== undefined);

  // design and plan: the design next to the specification, then the tasks along it, each checked by a judge
  let approved: string[];
  for (;;) {
    await runPhase(repoDir, planDir, agent, { name: 'design', input: designInput(feedback), maxRuns: 3 }, status);
    await runPhase(repoDir, planDir, agent, { name: 'plan', input: planInput(feedback), maxRuns: 3 }, status);

    // dispatch: no agent, a rule. It picks the tasks that nothing blocks
    status.tasks = await readyTasks(repoDir);

    // ✋ Checkpoint 2: you approve the plan with the tasks to build, or send it back: its tasks go, design and plan again
    const decision = await checkpoint('plan', 'waiting for your plan approval');
    if (decision.feedback === undefined) {
      approved = decision.tasks;
      break;
    }
    await removeTasks(planDir, written);
    feedback = decision.feedback;
  }

  // implement: one Ralph loop per task, each in its own worktree, all at the same time
  const loops = approved.map((task) =>
    executeChild(ralph, { workflowId: `pipeline-${task}`, args: [{ repoDir, agent, task, base }] }));
  const results = await Promise.allSettled(loops); // a loop that fails doesn't stop the others

  // review: a read-only agent checks every finished branch
  status.review = await runAgent({ repoDir, agent, mode: 'read', model: MODELS.review, step: 'review', prompt });

  // ✋ Checkpoint 3: waits for your merge decision
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

The `research`, `design` and `plan` skills usually ask you questions. In the pipeline, nobody is there to answer. So `workPrompt` in `prompts.ts` tells every agent to make a sensible assumption and write it down where the skill keeps assumptions. The judges check these first, and then you check them at the first checkpoint.

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
description: Judge another agent's run on a phase (research, design, plan or implement) like a stranger's work, and end with one verdict line.
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

```markdown [.agents/skills/judge/checks/design.md]
# Checks: design

The agent wrote the design for the specification, in `specs/<slug>/design.md`.

- Every acceptance criterion of the specification is served by the design: the modules, endpoints and
  tests it names.
- Nothing beyond the specification: no extra behaviour, endpoints, options or rules.
- The design follows the codebase around it: its structure, naming and error handling. Check that
  against the code, don't take the design's word for it.
- It names the tests to write before the code, and they cover every acceptance criterion.
- No literal code, and nothing called "optional" or "not needed".
- If the specification can be built in two ways that change what a user or caller sees, ask a question
  instead.
```

```markdown [.agents/skills/judge/checks/plan.md]
# Checks: plan

The agent turned the specification into tasks in `backlog/`.

- Every task is a vertical slice that a user can see or use, not a layer such as "database" or "UI".
- A `ready` task doesn't depend on any other new task. One that does is `blocked`, with those
  tasks in `blocked_by`.
- Together, the tasks cover the whole specification, and they follow the decisions of its design.md.
- Every acceptance criterion of the specification is owned by exactly one task. A task that only
  combines what another task built, for example "X together with Y", or that only adds tests for
  another task's behaviour, is not a slice: its criteria belong to the task that builds the
  behaviour. A small request is one task.
```

```markdown [.agents/skills/review/SKILL.md]
---
name: review
description: Review the branches built by other agents like a stranger's pull requests, against their tasks in backlog/, and end with APPROVE or REJECT per branch.
disable-model-invocation: true
---

## TASK

You review the branches built by other agents, each under `BRANCH <name>`: the pipeline asks whether to
merge them. You don't know how they were built: review each like a stranger's pull request. Read any file
you need, but don't change any. Every branch is checked against its task in `backlog/`, the task id is in
the branch name.

---

## STEPS

For every branch:

1. Check it against what was asked. Every acceptance criterion of the task is met by the change itself,
   not only by its tests, and nothing outside its scope changed.
   A `.harness/progress.md` on a branch means the loop didn't finish.

2. Check it against the checklist in `.agents/skills/change-quality/SKILL.md`. The tests already ran
   green, you don't need to run them. An item that doesn't hold is a reason to REJECT: say which.

---

## VERDICT

End without any formatting, no bullets, no bold, no backticks:

One line per branch: `<branch>: APPROVE` or `<branch>: REJECT: <reason>`. Every branch gets exactly one
such line, the last lines of your answer. A branch without one counts as rejected.
```

:::

</details>

### 5. Decide whether to merge

When the review agent is done, the merge decision waits for you. Click **Decide** to see the review's verdict for each branch. To see a branch's changes yourself, click its loop under **Loops** and click **Diff in IDE**.

Click **Merge** to merge. The workflow rebases each approved branch onto your branch, then runs the tests. Both tasks change the same dashboard page, so the second branch may conflict. Its loop then says `not merged`: click it and **Merge into your branch** to see how to rebase it by hand.

<FlowsWatch scene="lab12-merge" />

### 6. Look at the result

In a new terminal:

```bash
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. You should see the work of every merged branch.

### 7. Clean up

Stop the app (`Ctrl+C`), quit `flows watch` (`Ctrl+C` in its terminal) and clean up:

```bash
flows cleanup
```

This stops any running workflows and removes the worktrees and merged branches. Unmerged branches stay, and `flows cleanup` prints how to delete them. Your branch keeps the specification, the design, the tasks and the merged code.
