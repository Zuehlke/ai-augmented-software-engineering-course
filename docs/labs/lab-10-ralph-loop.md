# Lab 10 · Ralph loop

## Context

The longer an agent session runs, the worse it gets. The context fills up with old attempts and the agent loses track. A **Ralph loop** avoids this. It runs the same prompt again and again, each time with a fresh context:

- Each run does one small step on the ticket and commits it.
- The agent forgets everything between runs. It reads `.harness/progress.md` and the git history to see where it left off.
- After each run, a **judge** checks the work. First the tests run. Then a second, read-only agent checks the commit against a short checklist in its prompt. It didn't write the code, so it has no reason to defend it.
- If the judge finds a problem, the next run gets it as feedback and fixes it first.
- The loop stops when the ticket is `done`, or after 10 runs.

<RalphDiagram />

First you start one run and watch it. Then you let the loop run on its own.

## Your Task

Start the lab setup with the following command:

```bash
task lab/ralph-loop
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/ralph-loop`.
>
> [![Open Lab 10 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fralph-loop)

The branch contains the tracer-bullet `backlog/`. Only TICKET-1 (normalize the delay data model) is `ready`, the other three are `blocked` until it has landed.

> [!IMPORTANT]
> The agent runs unattended. Nobody answers permission prompts, so they are turned off. The sandbox keeps this safe. The agent can change files and commit, but it has no network access. Never run an unattended agent without the sandbox. It also needs the [agent token from the setup](/getting-started/setup#agent-token).

In **terminal 1**, start the Temporal server:

```bash
temporal server start-dev --db-filename ~/temporal.db
```

In **terminal 2**, start the worker. It shows what the agent and the judge do:

```bash
flows worker
```

Use **terminal 3** for the steps below. If you use GitHub Copilot CLI, set `AGENT=copilot` there first. The default is Claude Code.

### 1. One run, watching

Start the loop with only one run:

```bash
flows ralph TICKET-1 --runs 1
```

Watch terminal 2. First the agent does one step and commits. Then the judge checks it. When it's done, look at what changed:

```bash
git log --oneline -3
cat .harness/progress.md
```

Check three things. Is the step small? Do the tests pass? Could the next run continue using only `.harness/progress.md`? If not, improve `.harness/prompts/implement.md` and try again.

<details>
<summary><code>.harness/progress.md</code> after the first run</summary>

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
<summary><code>.harness/progress.md</code> after a few runs</summary>

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

## Blockers
- None.
```

Two criteria are still open. The next run finds that out from this file.

</details>

### 2. Let it loop

Now start the loop without a limit. It continues where the first run stopped, for at most 10 runs:

```bash
flows ralph TICKET-1
```

> [!IMPORTANT]
> Sometimes the judge can't decide alone, for example when the ticket contradicts the code. Then terminal 3 shows a question. Send your answer like this. The next run receives it:
>
> ```bash
> flows answer ralph-TICKET-1 "Keep the flat flights table until TICKET-4."
> ```

Pressing `Ctrl+C` in terminal 3 doesn't stop the loop. Run the same command again to follow it.

While the loop runs, read the code. `ralph.ts` is short. It calls `runPhase` with the phase `implement` and the ticket. `runPhase` does the actual work. It runs the agent, then the judge, and decides what happens next. It doesn't know about tickets, so later labs use it for other agents too.

::: code-group

```ts [.harness/flows/src/workflows/ralph.ts]
import { defineQuery, setHandler } from '@temporalio/workflow';
import type { RalphInput, RalphStatus } from '../shared';
import { ticketDone } from './activities';
import { runPhase } from './phase';

export const ralphStatus = defineQuery<RalphStatus>('status');

// Ralph is one phase: the agent takes one small step per run, until the ticket is done.
// `--runs 1` sets maxRuns to 1. Returns whether the ticket is done.
export async function ralph({ repoDir, agent, ticket, maxRuns = 10 }: RalphInput): Promise<boolean> {
  const status: RalphStatus = { ticket };
  setHandler(ralphStatus, () => status);

  await runPhase(repoDir, agent, {
    name: 'implement', // picks the prompts: prompts/implement.md and prompts/judge-implement.md
    input: `Your ticket: ${ticket}`,
    maxAttempts: maxRuns,
    done: () => ticketDone(repoDir, ticket),
  }, status);
  return ticketDone(repoDir, ticket);
}
```

```ts [.harness/flows/src/workflows/phase.ts]
import { ApplicationFailure, condition, defineSignal, log, setHandler } from '@temporalio/workflow';
import type { Agent, Phase, PhaseStatus, Verdict } from '../shared';
import { checkRules, lastCommit, readHarnessFile, runAgent, setFeedback } from './activities';
import { parseVerdict } from './text';

// Your answer when the judge asks a question. `flows answer` sends it.
export const answerSignal = defineSignal<[string]>('answer');

// The agent does the work. A separate judge checks it.
export async function runPhase(repoDir: string, agent: Agent, phase: Phase, status: PhaseStatus): Promise<void> {
  let answer: string | undefined;
  setHandler(answerSignal, (text) => void (answer = text));
  const prompt = await readHarnessFile(repoDir, `prompts/${phase.name}.md`);
  let feedback: string | null = null;

  let verdict: Verdict | undefined;

  for (status.attempt = 1; status.attempt <= phase.maxAttempts; status.attempt++) {
    await setFeedback(repoDir, feedback); // .harness/feedback.md, the agent reads it first
    await runAgent({ repoDir, agent, mode: 'write', prompt: `${prompt}\n\n${phase.input}` });

    verdict = await judge(repoDir, agent, phase);
    log.info(`== ${phase.name}: ${verdict.kind} ${verdict.reason}`);
    feedback = null;

    if (verdict.kind === 'PASS' && (!phase.done || (await phase.done()))) return;
    if (verdict.kind === 'RETRYABLE') feedback = `The judge rejected your work: ${verdict.reason}`;
    if (verdict.kind === 'AMBIGUOUS') {
      status.question = verdict.reason;
      await condition(() => answer !== undefined); // waits for your answer, costs nothing meanwhile
      feedback = `The judge asked: ${verdict.reason}\nA human answered: ${answer}`;
      status.question = answer = undefined;
    }
    if (verdict.kind === 'FAILED') throw ApplicationFailure.nonRetryable(verdict.reason);
  }
  // Out of attempts. If the last step passed, the work so far is good: stop without an error.
  if (verdict?.kind !== 'PASS') throw ApplicationFailure.nonRetryable(`No PASS after ${phase.maxAttempts} attempts`);
}

// The tests first: if they fail, there's no need to ask the judge agent
async function judge(repoDir: string, agent: Agent, phase: Phase): Promise<Verdict> {
  const broken = await checkRules(repoDir, phase.name); // for `implement`: the tests
  if (broken) return { kind: 'RETRYABLE', reason: broken };

  const prompt = await readHarnessFile(repoDir, `prompts/judge-${phase.name}.md`);
  const commit = await lastCommit(repoDir);
  const answer = await runAgent({ repoDir, agent, mode: 'read', prompt: `${prompt}\n\n${phase.input}\n\n${commit}` });
  return parseVerdict(answer); // its last line: PASS, RETRYABLE: …, AMBIGUOUS: … or FAILED: …
}
```

:::

<details>
<summary><code>.harness/prompts/implement.md</code>, the prompt every run gets</summary>

````markdown
# Implement

You work on one ticket in `backlog/`, one small step per run. Your ticket is given at the end. You
don't remember earlier runs: `.harness/progress.md`, `.harness/learnings.md` and the git history are
your memory.

1. Read `.harness/feedback.md`, `.harness/progress.md` and `.harness/learnings.md` (if they exist)
   and `git log --oneline -10`.
2. If `.harness/feedback.md` exists, the judge found a problem with your last step: fix that.
   Otherwise do the next step: work on one acceptance criterion that isn't met yet, never more.
3. Run `task test`. If it fails, fix it before you continue.
4. Update `.harness/progress.md`. Use this format:

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

5. If your step met the last open acceptance criterion: set the ticket's `status` to `done`. Copy
   the decisions that later tickets need to know to `.harness/learnings.md`, one line each, then
   delete `.harness/progress.md`.
6. Commit everything in exactly one commit. Then stop, even if criteria are still open: the next run
   does the next step. Don't push.
````

</details>

<details>
<summary><code>.harness/prompts/judge-implement.md</code>, the judge's prompt</summary>

The judge can't change files because its tools are removed, not because the prompt asks it not to. For the same reason, the workflow passes it the commit. The judge can't run `git` itself.

```markdown
# Judge: implement

Another agent just did one small step on the ticket below. Its last commit is at the end. Judge it
like a stranger's work. Read any file you need, but don't change any.

Check the step, not the whole ticket, which may still be in progress:

- It works on one acceptance criterion at most, without changing anything outside the ticket's scope.
- What `.harness/progress.md` claims under **Done** is really done, and covered by a test.
- If the ticket is set to `done`: every acceptance criterion is met.

End with exactly one line, without any formatting: `PASS`, `RETRYABLE: <what to fix>`,
`AMBIGUOUS: <question for a human>` or `FAILED: <why no further attempt can fix it>`.
```

</details>

### 3. Check the result

When the loop stops, terminal 3 tells you whether the ticket is done or why the loop stopped. Then check the result:

```bash
git log --oneline
task test
cat .harness/learnings.md
```

You should see one small commit per step, passing tests and TICKET-1 set to `done`. If terminal 2 shows the judge rejecting a step and the next run fixing it, the judge did its job.

`.harness/learnings.md` contains the decisions that later tickets need. Every run reads it, so review it like code. A wrong line misleads every later run.

Next, you'll run several Ralph loops at once.
