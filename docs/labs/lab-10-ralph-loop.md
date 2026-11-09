# Lab 10 · Ralph loop

## Context

The longer an agent session runs, the worse it gets: the context fills up with old attempts. A **Ralph loop** avoids this by running the same prompt in a loop until a task is done, each iteration with a fresh context:

- Each run takes one small step on the task, one acceptance criterion, tested and committed.
- The agent forgets everything between runs. `.harness/progress.md`, the same file as in [Structured agentic workflows](./lab-4-structured-agentic-workflows.md), and the git history are its memory.
- The loop stops when the task is `done`, after a maximum of 30 runs, or when the judge rejects 3 runs in a row.

<RalphDiagram />

Each run follows the **generator and validator** pattern: the agent generates the step, a **judge** validates it.

- The judge checks the step: first plain code (did it commit, do the tests pass, did it leave the skills and the harness alone?), then a read-only agent with the `judge` skill. A rejected step goes back to the next run as feedback.
- The implementor runs on Sonnet, its judge on Opus (on GPT-6.1 Sol with Copilot): a weaker judge would approve bad work.

<JudgeDiagram />

## Your Task

Start the lab setup with the following command:

```bash
task lab/ralph-loop
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/ralph-loop`.
>
> [![Open Lab 10 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fralph-loop)

> [!IMPORTANT]
> The agent runs unattended, with permission prompts turned off. The sandbox keeps this safe: the agent can change files and commit, but has no network access. Never run an unattended agent without it. It also needs the [agent token from the setup](/getting-started/setup#agent-token).

Start Temporal and the worker, and open `flows watch` on [http://localhost:8234](http://localhost:8234). Click **Copilot** next to **Agent** there to switch to GitHub Copilot CLI if you use it.

```bash
task flows:start
task flows:watch
```

### 1. One run, watching

The branch contains the tracer-bullet `backlog/`. Only TASK-1 (normalize the delay data model) is `ready`.

<FlowsWatch scene="lab10-one-run" />

Click **Implement a task…**, select TASK-1 and click **One run**. Watch the agent take a step and the judge check it. Look at the progress after 1 loop in a new terminal:

```bash
git log --oneline -3 agent/task-1
git show agent/task-1:.harness/progress.md
```

Throw the run away, so the next one starts fresh: click TASK-1 under **Loops**, click **Throw away**, then **Throw away** again.

<FlowsWatch scene="lab10-discard" />

<details>
<summary><code>.harness/progress.md</code> after the first run</summary>

```markdown
# Progress

## Task
TASK-1 Normalize delay data model

## Done
- Airline data (code, name) is stored and queryable independently of delay records:
  new `airlines` table, filled from the existing `AIRLINE` values, covered by
  `DelayDataModelTest.shouldStoreAirlinesIndependentlyOfDelayRecords`.

## Decisions
- The existing data stores airlines as names (`SWISS`, `LUFTHANSA`), not IATA codes. The new
  table keeps both: `code` (`LX`, `LH`) and `name` (`SWISS`, `Lufthansa`).

## Blockers
- None.
```

</details>

<details>
<summary><code>.agents/skills/implement/SKILL.md</code>, the skill every run uses</summary>

````markdown
---
name: implement
description: Take one small step on a task in backlog/, one acceptance criterion per run, tested and committed, with .harness/progress.md as the memory between runs.
disable-model-invocation: true
---

## TASK

You work on one task in `backlog/`, one small step per run. You don't remember earlier runs:
`.harness/progress.md`, `.harness/learnings.md` and the git history are your memory.

---

## STEPS

1. Read `.harness/run/feedback.md`, `.harness/progress.md` and `.harness/learnings.md` (if they exist)
   and `git log --oneline -10`. If the task names a `design:`, read it: follow its decisions.

2. If `.harness/run/feedback.md` exists, the judge found a problem with your last step: fix that.
   Otherwise pick the first acceptance criterion in the task that isn't under Done, write it in
   `.harness/progress.md` before you write any code, and build only what its test needs. Code or a test
   that another criterion needs is out of this step, even if it is one line. If feedback says a step did
   too much, keep its tested work, record each criterion it meets under Done, and don't delete tests or
   harness files to make the step smaller.

3. Write the tests with the change, following the testing skill in `.agents/skills/testing/SKILL.md`.
   For each acceptance criterion, name the test that covers it in `.harness/progress.md`.
   Before you commit, for each rule or branch this step adds: swap in the simplest wrong version of it,
   run the test you named for it, and see it fail. Then put the real code back. If no test can fail for it, delete
   it: it belongs to the step of the criterion that asks for it.
   For every input this step reads, write in `.harness/progress.md` the test for each case the testing
   skill lists for it. Don't set a task to `done` while a listed case has no test.

4. Run `task format`, then `task test`. If the tests fail, fix them before you continue.

5. Check your step against the checklist in `.agents/skills/change-quality/SKILL.md`, and fix what
   doesn't hold: the judge and the review check the same list.

6. Update `.harness/progress.md`, in the format of `.agents/skills/handoff-writing/templates/progress.md`.

7. If your step met the last open acceptance criterion: copy the decisions that later tasks need to
   know to `.harness/learnings.md`, one line each, delete `.harness/progress.md`, and only then set the
   task's `status` to `done`. A done task with a `.harness/progress.md` is rejected.

8. Commit everything in exactly one commit. Then stop, even if criteria are still open: the next run
   does the next step. Don't push.
````

</details>

<details>
<summary>The Ralph loop in the harness</summary>

Each run starts a fresh agent with the same prompt, then the judge checks it. Its verdict decides what happens next:

```ts
// .harness/src/workflows/phase.ts (excerpt)
for (let run = 1; run <= phase.maxRuns; run++) {
  await setFeedback(workDir, feedback); // .harness/run/feedback.md, the agent reads it first
  const before = await headCommit(workDir);
  // The agent takes one step, with a fresh context
  await runAgent({ repoDir, workDir, agent, mode: 'write', model: MODELS[phase.name], step: phase.name, prompt });

  // The judge checks the step: first plain code (commit, tests), then a read-only agent
  verdict = await judge(repoDir, workDir, agent, phase, before, status);

  switch (verdict.kind) {
    case 'PASS':
      if (await phase.done()) return; // the task is done
      failures = 0;
      feedback = null; // more to do: the next run takes the next step
      break;
    case 'RETRYABLE':
      failures++;
      feedback = `The judge rejected your work: ${verdict.reason}`;
      break;
    case 'AMBIGUOUS': // the loop waits for your answer
      feedback = `The judge asked: ${verdict.reason}\nA human answered: ${await askHuman(verdict.reason)}`;
      break;
  }
  if (failures >= MAX_FAILURES) throw ApplicationFailure.nonRetryable(`Stuck: ${failures} runs in a row rejected`);
}
```

</details>

### 2. Let it loop

This time, the loop doesn't stop after one run: it loops until the task is `done`. Click **Implement a task…**, select TASK-1 and click **Loop until done**. Each run continues where the last one stopped.

<FlowsWatch scene="lab10-loop" />

> [!IMPORTANT]
> When the judge can't decide alone, for example because the task contradicts the code, the loop waits for you. Click **Answer**, type your answer, for example `Keep the flat flights table until TASK-4.`, and click **Send**. The next run gets it.

### 3. Check the result

<FlowsWatch scene="lab10-merge" />

When the task is done, its loop says `done` and `not merged`. Click it, then **Merge into lab/ralph-loop** to bring its commits onto your branch (**Diff in IDE** shows them first). Then, in a terminal:

```bash
git log --oneline
task test
cat .harness/learnings.md
```

You should see one small commit per step, passing tests and TASK-1 set to `done`. `.harness/learnings.md` holds the decisions later tasks need. Every run reads it, so review it like code.

Next, you'll run several Ralph loops at once.
