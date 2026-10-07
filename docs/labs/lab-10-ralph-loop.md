# Lab 10 · Ralph loop

## Context

A long agent session gets worse the longer it runs: the context fills up with old attempts, and the agent loses track. A **Ralph loop** avoids that by running the same prompt again and again, each time in a **fresh context**:

- Every run does one small step on the ticket and commits it.
- Between runs, the agent remembers nothing. Its memory is `.harness/progress.md` and the git history.
- After every run, the loop checks the work. If a check fails, the next run gets the problem in `.harness/feedback.md` and fixes it first.
- The loop stops when the ticket is `done`, or after 10 runs.

You've seen the memory part before: in *Structured agentic workflows*, `implement` kept `specs/<slug>/progress.md` so that a new session could continue where the last one stopped. Ralph starts a new session after every step on purpose, and `.harness/progress.md` uses the same format, with a ticket instead of a specification.

You start with one run and watch it. Once that looks good, you let the loop run on its own, inside the sandbox.

## Your Task

Start the lab setup with the following command:

```bash
task lab/ralph-loop
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/ralph-loop`.
>
> [![Open Lab 10 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fralph-loop)

The branch contains the tracer-bullet `backlog/`. Only TICKET-1 (normalize the delay data model) is `ready`, the other three are `blocked` until it has landed. `.harness/prompts/ralph.md` is the prompt every run gets:

<details>
<summary><code>.harness/prompts/ralph.md</code> (already in the branch)</summary>

````markdown
# Ralph

You work on one ticket in `backlog/`, one small step per run. Your ticket is given at the end. You
don't remember earlier runs: `.harness/progress.md`, `.harness/learnings.md` and the git history are
your memory.

1. Read `.harness/feedback.md`, `.harness/progress.md` and `.harness/learnings.md` (if they exist)
   and `git log --oneline -10`.
2. If `.harness/feedback.md` exists, the script found a problem with your last step: fix that.
   Otherwise do the next small step towards the ticket's acceptance criteria. One logical change,
   not the whole ticket.
3. Run `task test`. If it fails, fix it before you continue.
4. Update `.harness/progress.md` and commit it together with your change. Use this format:

   ```markdown
   # Progress

   ## Ticket
   <ticket id> <ticket title>

   ## Done
   - <acceptance criterion that is met>: <what you built for it>

   ## Decisions
   - <choice you made and why>

   ## Blockers
   - <what is stuck, or "None.">
   ```

5. When every acceptance criterion is met: set the ticket's `status` to `done`. Copy the decisions
   that later tickets need to know to `.harness/learnings.md`, one line each, then delete
   `.harness/progress.md` and commit.

Do exactly one step per run, then stop. Don't push.
````

</details>

### 1. One run, watching

Start a single run in a normal, interactive session:

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

```bash
AGENT=copilot .harness/workflows/ralph-once.sh TICKET-1
```

  </template>
  <template #tab2>

```bash
.harness/workflows/ralph-once.sh TICKET-1
```

  </template>
</ContentTabs>

Watch what the agent does and answer its permission prompts. When it's done, exit the session and check what it left behind:

```bash
git log --oneline -3
cat .harness/progress.md
```

<details>
<summary>After the first run</summary>

```markdown
# Progress

## Ticket
TICKET-1 Normalize delay data model

## Done
- Airline data (code, name) is stored and queryable independently of delay records:
  new `airlines` table, filled from the existing `AIRLINE` values.

## Decisions
- The existing data stores airlines as names (`SWISS`, `LUFTHANSA`), not IATA codes. The new
  table keeps both: `code` (`LX`, `LH`) and `name` (`SWISS`, `Lufthansa`).

## Blockers
- None.
```

</details>

<details>
<summary>After a few more runs</summary>

```markdown
# Progress

## Ticket
TICKET-1 Normalize delay data model

## Done
- Airline data (code, name) is stored and queryable independently of delay records:
  new `airlines` table, filled from the existing `AIRLINE` values.
- Flight data is stored independently of delay records: new `flights_v2` table with airline,
  schedule and airports.
- Delay events are linked to a flight, with several events per flight: new `delay_events` table.

## Decisions
- The existing data stores airlines as names (`SWISS`, `LUFTHANSA`), not IATA codes. The new
  table keeps both: `code` (`LX`, `LH`) and `name` (`SWISS`, `Lufthansa`).
- The existing data has no airport codes. `departure_airport` and `arrival_airport` are nullable
  for now instead of made up.
- The flat `flights` table stays until `/delays` reads from the new tables, so the endpoint keeps
  working in between. It gets removed in the last step.

## Blockers
- None.
```

Two criteria are still open, no data loss for `/delays` and efficient lookups, so the next run knows what to do without reading any old conversation.

</details>

Is the step small? Are the tests green? Would the next run know where to continue just from `.harness/progress.md`? If not, improve `.harness/prompts/ralph.md` and run it again.

### 2. Let it loop

The loop runs unattended, so it needs the [agent token from the setup](/getting-started/setup#agent-token).

In **terminal 1**, start the Temporal server:

```bash
temporal server start-dev --db-filename ~/temporal.db
```

In **terminal 2**, start the worker. The agent output shows up there:

```bash
flows worker
```

Then start the loop in **terminal 3**:

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

```bash
AGENT=copilot flows ralph TICKET-1
```

  </template>
  <template #tab2>

```bash
flows ralph TICKET-1
```

  </template>
</ContentTabs>

The `ralph` workflow runs one agent after another. After every run, it checks the work itself instead of trusting the agent:

1. It runs the tests: the same check as the hook from *Automated feedback loops*, now run by the workflow.
2. A second agent reviews the last commit against the ticket. It's read-only and didn't write the code, so it has nothing to defend.
3. It reads the ticket's `status`. Once it's `done`, the loop stops.

If check 1 or 2 fails, the reason goes to `.harness/feedback.md` and the next run starts.

::: code-group

```ts [.harness/flows/src/workflows/ralph.ts]
import { defineQuery, log, setHandler } from '@temporalio/workflow';
import type { RalphInput, RalphResult, RalphStatus } from '../shared';
import { lastCommit, readHarnessFile, runAgent, runTests, setFeedback, ticketDone } from './activities';
import { lastLine } from './text';

export const ralphStatus = defineQuery<RalphStatus>('status');

const MAX_RUNS = 10;

// One agent run after another, until the ticket is done, at most 10 runs
export async function ralph({ repoDir, agent, ticket }: RalphInput): Promise<RalphResult> {
  const status: RalphStatus = { ticket, run: 0, lastCheck: 'none yet' };
  setHandler(ralphStatus, () => status);

  await ticketDone(repoDir, ticket); // fails the workflow right here if the ticket doesn't exist
  const prompt = `${await readHarnessFile(repoDir, 'prompts/ralph.md')}\n\nYour ticket: ${ticket}`;
  const stepReviewer = await readHarnessFile(repoDir, 'prompts/step-reviewer.md');
  let feedback: string | null = null;

  for (let run = 1; run <= MAX_RUNS; run++) {
    status.run = run;
    log.info(`== Run ${run}`);
    await setFeedback(repoDir, feedback); // .harness/feedback.md, the agent reads it first
    await runAgent({ repoDir, agent, mode: 'write', prompt });
    await setFeedback(repoDir, null); // the agent has read it
    feedback = null;

    // After every run, the workflow checks the work itself. A failed check becomes the
    // feedback for the next run.

    // Check 1: the tests pass
    const tests = await runTests(repoDir);
    if (!tests.pass) {
      feedback = `The tests fail. The end of their output:\n\n${tests.tail}`;
      status.lastCheck = 'tests fail';
      log.info('== Tests fail');
      continue;
    }

    // Check 2: a second, read-only agent approves the last commit
    const review = await runAgent({ repoDir, agent, mode: 'read', prompt: `${stepReviewer}\n\n${await lastCommit(repoDir)}` });
    const verdict = lastLine(review, /^(PASS|FAIL)/) ?? 'FAIL: the reviewer gave no verdict';
    status.lastCheck = `reviewer: ${verdict}`;
    log.info(`== Reviewer: ${verdict}`);
    if (!verdict.startsWith('PASS')) {
      feedback = `A reviewer rejected your last commit: ${verdict}`;
      continue;
    }

    // Check 3: the ticket is done
    if (await ticketDone(repoDir, ticket)) {
      status.lastCheck = 'ticket done';
      return { ticket, done: true, runs: run };
    }
  }
  return { ticket, done: false, runs: MAX_RUNS };
}
```

:::

The agent output shows up in the worker in terminal 2. In the web UI at [http://localhost:8233](http://localhost:8233), `ralph-TICKET-1` lists every run, test result and verdict.

> [!NOTE]
> `Ctrl+C` in terminal 3 only stops waiting, the loop goes on. Run the same command again to follow it.

<details>
<summary><code>.harness/prompts/step-reviewer.md</code> (already in the branch)</summary>

```markdown
# Step reviewer

Another agent just made one small step towards a ticket in `backlog/`. Its last commit is below. You
don't know how it was built, review it like a stranger's commit. The ticket it works on is named in
`.harness/progress.md` (in the commit, or in the repository).

Read the ticket. Then check the step, not the whole ticket, which may still be in progress:

- Does it move towards an acceptance criterion, without changing anything outside the ticket's scope?
- Is what it claims under **Done** in `.harness/progress.md` really done, and covered by a test?
- If the ticket is set to `done`: is every acceptance criterion met?

The tests already ran and are green, you don't need to run them. Don't change any file.

End with exactly one line, without any formatting: `PASS` or `FAIL: <what to fix>`.
```

</details>

Both agents run headless with a fresh context, one with write access and one read-only.

The reviewer is read-only because its tools are taken away, not because the prompt asks nicely. That's also why the workflow puts the commit into its prompt: it can't run `git` itself.

> [!IMPORTANT]
> Nobody answers permission prompts during the loop, so they are switched off for the Ralph run. The sandbox keeps it safe: the agent can change files and commit, but it can't reach the network. Never run an unattended loop without it.

### 3. Check the result

When the loop stops, look at what it did:

```bash
git log --oneline
task test
cat .harness/learnings.md
```

You should see one small commit per step, green tests, TICKET-1 set to `done` and no `.harness/progress.md` left. A `== Reviewer: FAIL: ...` in the worker output, followed by a run that fixes it, is the loop doing its job.

Before deleting `.harness/progress.md`, the agent copied the decisions later tickets need into `.harness/learnings.md`. Every run reads it first, so review it like code: a wrong line misleads every later run.

Next, you'll run several Ralph loops at once.
