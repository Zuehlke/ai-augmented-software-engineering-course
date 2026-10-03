# Lab 13 · Evals

## Context

Everything you built today started with the `to-issues` skill: it turned the feature request into the backlog that the Ralph loops worked through. If someone changes the skill and it gets worse, say it starts splitting by layer or forgets a blocker, you'd only notice much later, when agents are already building the wrong tickets.

Trying the skill once and eyeballing the result doesn't catch that. An **eval** does it automatically, after every change:

| Term | What it means |
| --- | --- |
| **Case** | A fixed input for the skill, here a feature request. |
| **Rubric** | What a good result for that case looks like, written down as a short checklist. |
| **Judge** | A separate agent that grades the skill's result against the rubric and answers `PASS` or `FAIL`. |
| **Runs** | Agent output varies from run to run, so every case runs three times. It passes when most runs pass. |

## Your Task

Start the lab setup with the following command:

```bash
task lab/evals
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/evals`.
>
> [![Open Lab 13 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fevals)

The branch contains the `to-issues` skill, three eval cases in `.harness/evals/cases/`, and the `evals` workflow in `.harness/flows/src/workflows/evals.ts`.

Every case is a folder with a `request.md` (the input) and a `rubric.md` (the checklist):

<details>
<summary>The cases in <code>.harness/evals/cases/</code></summary>

**`dashboard/`**: the Flight Delays Dashboard feature request from the tracer-bullet lab. Its rubric:

```markdown
- The data model cleanup is its own ticket, and it comes first.
- There is no horizontal ticket such as "build the UI" or "add the endpoints". Prefactoring, such as
  the data model cleanup or loading the airport dataset, may have its own ticket.
- The airport details work is blocked by the missing airport dataset, directly or through a ticket
  that waits for it.
- The airline overview and flight status tickets are blocked by the data model ticket.
```

**`airport-data-available/`**: the same feature request, but the data team has delivered the airport dataset. Its rubric:

```markdown
- No ticket is blocked because the airport dataset is missing.
- The data model cleanup is still blocked, by the pending architecture review.
```

**`single-change/`**: "Add a `GET /health` endpoint that returns `200 OK` while the app is running." Its rubric:

```markdown
- There is exactly one ticket, and it is ready.
- It doesn't add scope the request didn't ask for (no monitoring, no auth, no dashboard).
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

### 1. Run the eval

```bash
flows eval
```

After a minute or two, you get one block per case: the result, then the judge's verdict of each run:

```text
== airport-data-available: PASS, 3 of 3 runs pass
- PASS: No ticket is blocked because the airport dataset is missing, ...
...
== dashboard: PASS, 3 of 3 runs pass
...
== single-change: PASS, 3 of 3 runs pass
...
3 cases passed, 0 failed.
```

All three cases should pass. A single failed run is fine, that's what the three runs are for.

Here's the workflow:

::: code-group

```ts [.harness/flows/src/workflows/evals.ts]
import type { Agent, EvalCase, EvalInput, EvalResult } from '../shared';
import { listEvalCases, runAgent } from './activities';
import { lastLine } from './text';

// Agent output varies from run to run, so every case runs three times and passes when most runs pass
const RUNS = 3;

// Runs to-issues on every case, then lets a separate judge grade the result. All runs start at once.
export async function evals({ repoDir, agent }: EvalInput): Promise<EvalResult[]> {
  const cases = await listEvalCases(repoDir);

  return Promise.all(
    cases.map(async (evalCase) => {
      const verdicts = await Promise.all(Array.from({ length: RUNS }, () => runOnce(repoDir, agent, evalCase)));
      const passed = verdicts.filter((verdict) => verdict.startsWith('PASS')).length;
      return { name: evalCase.name, pass: passed > RUNS / 2, verdicts };
    }),
  );
}

// One run of a case: the skill, then the judge. Both agents are read-only: the skill only presents a
// breakdown, the judge only grades it.
async function runOnce(repoDir: string, agent: Agent, { request, rubric }: EvalCase): Promise<string> {
  const breakdown = await runAgent({
    repoDir,
    agent,
    mode: 'read',
    prompt: `Use the to-issues skill in .agents/skills/to-issues/SKILL.md on the feature
request below, as if nothing of it were built yet: ignore backlog/ and the existing code.
Only present the breakdown, don't write any files.

${request}`,
  });

  const answer = await runAgent({
    repoDir,
    agent,
    mode: 'read',
    prompt: `Grade the BREAKDOWN below against the RUBRIC. Reply with exactly one line, without any formatting:
'PASS: <reason>' or 'FAIL: <reason>'. Every rubric item must be met.

RUBRIC:
${rubric}

BREAKDOWN:
${breakdown}`,
  });

  return lastLine(answer, /^(PASS|FAIL)/) ?? `FAIL: the judge gave no verdict: ${answer.trim()}`;
}
```

:::

Three things to notice:

- **The judge is its own agent process**, not a continuation of the run it grades. A judge that remembers producing the answer tends to defend it instead of grading it.
- **Both agents run with `mode: 'read'`**: the skill can only present a breakdown, not write tickets to `backlog/`, and the judge can only grade.
- **All runs start at once** (`Promise.all`): 3 cases × 3 runs, each run being two activities, first the skill, then the judge. Reading the case folders is I/O, so that's an activity too, `listEvalCases`.

### 2. Break the skill

Now make the skill worse on purpose. Open `.agents/skills/to-issues/SKILL.md` and replace **step 2, including all of its bullet points**, with:

```markdown
2. Break the remaining scope into horizontal layers: one ticket for the database, one for the
   endpoints, one for the UI.
```

Run the eval again:

```bash
flows eval
```

This time, `dashboard` fails, and the judge names the reason, for example a "database layer" or "UI" ticket:

```text
== dashboard: FAIL, 0 of 3 runs pass
- FAIL: The breakdown uses horizontal tickets (TICKET-3 database layer, TICKET-4 endpoints, TICKET-5 UI), ...
...
2 cases passed, 1 failed.
```

That's the point of an eval: a change that makes the skill worse shows up right away, not weeks later in the backlog.

To see each run's breakdown, open the web UI at [http://localhost:8233](http://localhost:8233) and click the `evals` workflow. Every `runAgent` activity's result is in its event history. In **GitHub Codespaces**, open the **Ports** tab and click the globe icon next to port `8233` (**Temporal UI**).

### 3. Restore the skill

```bash
git checkout .agents/skills/to-issues/SKILL.md
```

> [!NOTE]
> An eval is only as good as its cases. `airport-data-available` exists because a skill that simply copies blockers from the request would pass `dashboard` but fail here. When the skill fails in real use, add that input as a new case, so it can't break the same way twice. These cases already found a weakness: the skill sometimes added an empty "page shell" ticket, so the line about shared pages in step 2 was added.
