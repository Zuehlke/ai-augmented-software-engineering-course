# Lab 10 · Ralph loop

## Context

The longer an agent session runs, the worse it gets. The context fills up with old attempts and the agent loses track. A **Ralph loop** avoids this. It runs the same prompt again and again, each time with a fresh context:

- Each run does one small step on the ticket and commits it.
- The agent forgets everything between runs. It reads `.harness/progress.md` and the git history to see where it left off.
- After each run, a **judge** checks the work. First plain code checks the run: did it commit, did it leave anything uncommitted, did it change `.agents/` or `.harness/`? Then the tests run. Then a second, read-only agent checks the run's commits with the `judge` skill. It didn't write the code, so it has no reason to defend it.
- If the judge finds a problem, the next run gets it as feedback and fixes it first.
- The loop and its judge don't have to use the same model. The Ralph loop runs often, so it uses Sonnet. The judge is the quality gate and uses Opus: a weaker judge would approve bad work.
- The loop commits on its own branch, `agent/<ticket>`. Your checkout stays as it is until you merge it.
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

In **terminal 1**, start Temporal and the worker, and open `flows watch`. If you use GitHub Copilot CLI, set `AGENT=copilot` there first. The default is Claude Code.

```bash
task flows:start
task flows:watch
```

`flows watch` shows the loops, and below them the worker's output: what the agent and the judge do. Press `Tab` to switch to the backlog board. Use **terminal 2** to look at the code.

### 1. One run, watching

<FlowsWatch scene="lab10-one-run" />

In `flows watch`, press `Tab` to see the backlog board. Select TICKET-1 in **Ready** with the arrow keys, press `s`, then `1` for one run.

Watch the worker output: press `Tab` to get back to it. First the agent does one step and commits. Then the judge checks it. When it's done, look at what changed on the loop's branch, in terminal 2:

```bash
git log --oneline -3 agent/ticket-1
git show agent/ticket-1:.harness/progress.md
```

Check three things. Is the step small? Do the tests pass? Could the next run continue using only `.harness/progress.md`? If not, improve `.agents/skills/implement/SKILL.md` and commit it. Then throw the run away, so the next one starts fresh with your skill, and try again: on the board, select TICKET-1, press `Enter` to open it, `x` to throw the run away, and `y`. That removes the loop's worktree and deletes `agent/ticket-1`.

<FlowsWatch scene="lab10-discard" />

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

<FlowsWatch scene="lab10-loop" />

Now start the loop without a limit: select TICKET-1 on the board, press `s`, then `y`. It continues where the first run stopped, for at most 10 runs.

> [!IMPORTANT]
> Sometimes the judge can't decide alone, for example when the ticket contradicts the code. Then `flows watch` shows that the loop needs you. Press `n`, type your answer, for example `Keep the flat flights table until TICKET-4.`, and press `Enter`. The next run receives it.

Quitting `flows watch` with `q` doesn't stop the loop. It runs on the server. Open `flows watch` again to follow it.

While the loop runs, read the code. `ralph.ts` is short. It calls `runPhase` with the phase `implement` and the ticket. `runPhase` does the actual work. It runs the agent, then the judge, and decides what happens next. It doesn't know about tickets, so later labs use it for other agents too.

::: code-group

```ts [.harness/flows/src/workflows/ralph.ts]
import { setHandler } from '@temporalio/workflow';
import type { RalphInput, RalphStatus } from '../shared';
import { runTests, ticketDone } from './activities';
import { runPhase } from './phase';
import { ralphStatus } from './signals';

// Ralph is one phase: the agent takes one small step per run, until the ticket is done.
// One run in `flows watch` (or `--runs 1`) sets maxRuns to 1. Returns whether the ticket is done.
export async function ralph({ repoDir, agent, ticket, maxRuns = 10, base }: RalphInput): Promise<boolean> {
  const status: RalphStatus = { ticket };
  setHandler(ralphStatus, () => status);

  // The loop commits on the branch agent/<ticket>, in a folder of its own: workDir. Lab 11 shows how.
  const workDir = …;

  if (await ticketDone(workDir, ticket)) return true; // also fails the workflow right here if the ticket doesn't exist
  await runPhase(repoDir, workDir, agent, {
    name: 'implement', // the implement skill, checked with the judge skill
    input: `Your ticket: ${ticket}`,
    maxRuns,
    // If the tests fail, there's no need to ask the judge agent
    check: async () => {
      const tests = await runTests(workDir);
      return tests.pass ? null : `The tests fail. The end of their output:\n\n${tests.tail}`;
    },
    done: () => ticketDone(workDir, ticket),
  }, status);
  return ticketDone(workDir, ticket);
}
```

```ts [.harness/flows/src/workflows/phase.ts]
import { ApplicationFailure, condition, log, setHandler } from '@temporalio/workflow';
import type { Agent, Changes, Phase, PhaseStatus, Verdict } from '../shared';
import { MODELS } from '../shared';
import { changesSince, headCommit, requireCommitted, resetTo, runAgent, setFeedback } from './activities';
import { judgePrompt, skillFile, workPrompt } from './prompts';
import { answerSignal } from './signals';
import { parseVerdict } from './text';

// The agent does the work in workDir, one run after the other, with the skill named like the
// phase. A separate judge checks each run, with the judge skill. The agent mustn't change the skills.
// The sandbox profile comes from repoDir, your checkout.
export async function runPhase(repoDir: string, workDir: string, agent: Agent, phase: Phase, status: PhaseStatus): Promise<void> {
  let answer: string | undefined;
  setHandler(answerSignal, (text) => void (answer = text));

  // Waits for your answer to the judge's question. Costs nothing meanwhile, for days if need be.
  const askHuman = async (question: string): Promise<string> => {
    answer = undefined; // only an answer to this question counts
    status.question = question;
    await condition(() => answer !== undefined);
    status.question = undefined;
    return answer!;
  };

  // The agents read the skills from their branch, which only has what's committed
  await requireCommitted(repoDir, skillFile(phase.name));
  await requireCommitted(repoDir, skillFile('judge'));
  let feedback: string | null = null; // what the next run learns about this one
  let verdict: Verdict | undefined;

  try {
    for (let run = 1; run <= phase.maxRuns; run++) {
      status.run = run;
      await setFeedback(workDir, feedback); // .harness/run/feedback.md, the agent reads it first
      const before = await headCommit(workDir);
      await runAgent({ repoDir, workDir, agent, mode: 'write', model: MODELS[phase.name], step: phase.name, prompt: workPrompt(phase.name, phase.input) });

      status.judging = true; // `flows watch` lights up the judge
      try {
        verdict = await judge(repoDir, workDir, agent, phase, before);
      } finally {
        status.judging = false;
      }
      log.info(`== ${phase.name}: ${verdict.kind} ${verdict.reason}`);

      switch (verdict.kind) {
        case 'PASS':
          if (!phase.done || (await phase.done())) return;
          if (run === phase.maxRuns) return; // out of runs, but the work so far is good: stop without an error
          feedback = null; // more to do: the next run takes the next step
          break;
        case 'RETRYABLE':
          feedback = `The judge rejected your work: ${verdict.reason}`;
          break;
        case 'AMBIGUOUS':
          feedback = `The judge asked: ${verdict.reason}\nA human answered: ${await askHuman(verdict.reason)}`;
          break;
        case 'FAILED':
          throw ApplicationFailure.nonRetryable(verdict.reason);
      }
    }
    throw ApplicationFailure.nonRetryable(`Out of runs: ${phase.maxRuns} runs without a PASS. The judge's last verdict: ${verdict?.kind} ${verdict?.reason}`);
  } finally {
    await setFeedback(workDir, null); // the feedback was for this phase only
  }
}

// Plain code first: the rules below, then the phase's check (Ralph's: the tests). Only if they find
// nothing, the judge agent reads what the agent committed. It's slower, and it can be wrong.
async function judge(repoDir: string, workDir: string, agent: Agent, phase: Phase, before: string): Promise<Verdict> {
  const changes = await changesSince(workDir, before);
  const touched = changes.files.filter((file) => PROTECTED.some((p) => file.startsWith(p)));
  if (touched.length) {
    await resetTo(workDir, before);
    return { kind: 'RETRYABLE', reason: `you changed ${touched.join(', ')}, which you must not change. Your run was thrown away.` };
  }
  const broken = brokenRule(changes) ?? (phase.check ? await phase.check() : null);
  if (broken) return { kind: 'RETRYABLE', reason: broken };

  const answer = await runAgent({ repoDir, workDir, agent, mode: 'read', model: MODELS.judge, step: `judge ${phase.name}`, prompt: judgePrompt(phase.name, phase.input, changes.commits) });
  return parseVerdict(answer); // its last line: PASS, RETRYABLE: …, AMBIGUOUS: … or FAILED: …
}

// What the agent follows and gets judged by. It must not change it: a run that does is thrown away.
const PROTECTED = ['.agents/', '.harness/sandbox/', '.harness/flows/', 'Taskfile.yml'];

// The judge's rules: what's broken about the run, or null
export function brokenRule({ files, uncommitted }: Changes): string | null {
  if (!files.length) return "you didn't commit anything. Commit your work.";
  if (uncommitted.length) return `you left changes you didn't commit: ${uncommitted.join(', ')}. Commit them or remove them.`;
  return null;
}
```

:::

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
<summary><code>.harness/flows/src/workflows/prompts.ts</code>, what the harness adds to the skills</summary>

The skills are the same ones you could use yourself. The harness only adds what's different when nobody watches.

```ts
// What the harness tells each agent. The work itself is in the skills, .agents/skills/<name>/SKILL.md, the
// same skills you use yourself in the earlier labs. This only adds what's different when nobody watches.
import type { PhaseName } from '../shared';

// Where an agent finds a skill
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
```

</details>

<details>
<summary><code>.agents/skills/judge/SKILL.md</code>, the judge's skill (excerpt)</summary>

The judge can't change files because its tools are removed, not because the skill asks it not to. For the same reason, the workflow passes it the run's commits. The judge can't run `git` itself.

```markdown
---
name: judge
description: Judge another agent's run on a phase (research, slice or implement) like a stranger's work, and end with one verdict line.
disable-model-invocation: true
---

## TASK

Another agent just did a run on the phase named below, for the input below. Its commits are at the
end. Judge them like a stranger's work. Read any file you need, but don't change any.

---

## CHECKS

Use the checks of the phase you judge.

…

### implement

The agent did one small step on the ticket. Check the step, not the whole ticket, which may still be
in progress:

- It works on one acceptance criterion at most, without changing anything outside the ticket's scope.
- What `.harness/progress.md` claims under **Done** is really done, and covered by a test.
- If the ticket is set to `done`: every acceptance criterion is met.

---

## VERDICT

End with exactly one line, without any formatting: `PASS`, `RETRYABLE: <what to fix>`,
`AMBIGUOUS: <question for a human>` or `FAILED: <why no further attempt can fix it>`.
```

</details>

### 3. Check the result

<FlowsWatch scene="lab10-merge" />

When the loop stops, `flows watch` shows whether the ticket is done or why the loop stopped. The work is on `agent/ticket-1`. When the ticket is done, its card waits for you with `ready to merge`. Select it, press `Enter`, then `m`: `flows watch` shows the commits the branch brings. Press `y` to bring them onto your branch. Then check the result in terminal 2:

```bash
git log --oneline
task test
cat .harness/learnings.md
```

You should see one small commit per step, passing tests and TICKET-1 set to `done`. If the worker output shows the judge rejecting a step and the next run fixing it, the judge did its job.

`.harness/learnings.md` contains the decisions that later tickets need. Every run reads it, so review it like code. A wrong line misleads every later run.

Next, you'll run several Ralph loops at once.
