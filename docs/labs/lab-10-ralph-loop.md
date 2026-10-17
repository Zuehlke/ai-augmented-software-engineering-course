# Lab 10 · Ralph loop

## Context

The longer an agent session runs, the worse it gets: the context fills up with old attempts. A **Ralph loop** avoids this by running the same prompt again and again, each time with a fresh context:

- Each run takes one small step on the ticket, one acceptance criterion, tested and committed.
- The agent forgets everything between runs. `.harness/progress.md`, the same file as in [Structured agentic workflows](./lab-4-structured-agentic-workflows.md), and the git history are its memory.
- After each run, a **judge** checks the step: first plain code (did it commit, do the tests pass, did it leave the skills and the harness alone?), then a read-only agent with the `judge` skill. The agent and the judge use the same checklist, the `change-quality` skill. A rejected step goes back to the next run as feedback.
- The loop runs on Sonnet, its judge on Opus: a weaker judge would approve bad work.
- The loop commits on its own branch, `agent/<ticket>`, and stops when the ticket is `done`, or when the judge rejects 3 runs in a row.

<RalphDiagram />

## Your Task

Start the lab setup with the following command:

```bash
task lab/ralph-loop
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/ralph-loop`.
>
> [![Open Lab 10 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fralph-loop)

The branch contains the tracer-bullet `backlog/`. Only TICKET-1 (normalize the delay data model) is `ready`.

> [!IMPORTANT]
> The agent runs unattended, with permission prompts turned off. The sandbox keeps this safe: the agent can change files and commit, but has no network access. Never run an unattended agent without it. It also needs the [agent token from the setup](/getting-started/setup#agent-token).

In **terminal 1**, start Temporal and the worker, and open `flows watch`. Press `a` there to switch to GitHub Copilot CLI if you use it. Use **terminal 2** to look at the code.

```bash
task flows:start
task flows:watch
```

### 1. One run, watching

<FlowsWatch scene="lab10-one-run" />

Press `Tab` for the board, select TICKET-1 in **Ready**, press `s`, then `1` for one run. `Tab` back to watch the agent take a step and the judge check it. Then look at the loop's branch in terminal 2:

```bash
git log --oneline -3 agent/ticket-1
git show agent/ticket-1:.harness/progress.md
```

Is the step small, one acceptance criterion with its test? Could the next run continue from `.harness/progress.md` alone? If not, improve `.agents/skills/implement/SKILL.md` and commit it. Then throw the run away, so the next one starts fresh with your skill: on the board, open TICKET-1 with `Enter`, press `x`, then `y`.

<FlowsWatch scene="lab10-discard" />

<details>
<summary><code>.harness/progress.md</code> after the first run</summary>

```markdown
# Progress

## Ticket
TICKET-1 Normalize delay data model

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
description: Take one small step on a ticket in backlog/, one acceptance criterion per run, tested and committed, with .harness/progress.md as the memory between runs.
disable-model-invocation: true
---

## TASK

You work on one ticket in `backlog/`, one small step per run. You don't remember earlier runs:
`.harness/progress.md`, `.harness/learnings.md` and the git history are your memory.

---

## STEPS

1. Read `.harness/run/feedback.md`, `.harness/progress.md` and `.harness/learnings.md` (if they exist)
   and `git log --oneline -10`.

2. If `.harness/run/feedback.md` exists, the judge found a problem with your last step: fix that.
   Otherwise pick the first acceptance criterion in the ticket that isn't under Done, write it in
   `.harness/progress.md` before you write any code, and build only what its test needs. Code or a test
   that another criterion needs is out of this step, even if it is one line. If feedback says a step did
   too much, keep its tested work, record each criterion it meets under Done, and don't delete tests or
   harness files to make the step smaller.

3. Write the tests with the change, following the testing skill in `.agents/skills/testing/SKILL.md`.
   For each acceptance criterion, name the test that covers it in `.harness/progress.md`, and make
   sure it fails without your change.

4. Run `task test`. If it fails, fix it before you continue.

5. Check your step against the checklist in `.agents/skills/change-quality/SKILL.md`, and fix what
   doesn't hold: the judge and the review check the same list.

6. Update `.harness/progress.md`, in the format of `.agents/skills/handoff-writing/templates/progress.md`.

7. If your step met the last open acceptance criterion: copy the decisions that later tickets need to
   know to `.harness/learnings.md`, one line each, delete `.harness/progress.md`, and only then set the
   ticket's `status` to `done`. A done ticket with a `.harness/progress.md` is rejected.

8. Commit everything in exactly one commit. Then stop, even if criteria are still open: the next run
   does the next step. Don't push.
````

</details>

### 2. Let it loop

<FlowsWatch scene="lab10-loop" />

Select TICKET-1 on the board, press `s`, then `y`. The loop continues where the last run stopped, until the ticket is done.

> [!IMPORTANT]
> When the judge can't decide alone, for example because the ticket contradicts the code, the loop waits for you. Press `n`, type your answer, for example `Keep the flat flights table until TICKET-4.`, and press `Enter`. The next run gets it.

Quitting `flows watch` with `q` doesn't stop the loop: it runs in Temporal.

### 3. Check the result

<FlowsWatch scene="lab10-merge" />

When the ticket is done, its card waits for you with `ready to merge`. Open it with `Enter`, press `m` to see the commits, and `y` to bring them onto your branch. In terminal 2:

```bash
git log --oneline
task test
cat .harness/learnings.md
```

You should see one small commit per step, passing tests and TICKET-1 set to `done`. `.harness/learnings.md` holds the decisions later tickets need. Every run reads it, so review it like code.

Next, you'll run several Ralph loops at once.
