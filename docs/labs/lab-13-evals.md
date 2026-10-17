# Lab 13 · Evals

## Context

A skill only helps when the agent loads it. Nobody types "use the testing skill" in a real session: the agent reads every skill's `description` and decides on its own. If someone rewrites a description, renames a skill, or adds a new one that overlaps, the agent may quietly stop loading it. Nothing fails. The agent just writes code without the tests the skill asks for.

Trying it once by hand doesn't catch that. An **eval** does it automatically, after every change. This lab has two:

- The **skill-loaded evals** check whether the agent loads the skills from the earlier labs when it should, and only then. They are short and cheap.
- The **evals** grade the whole setup, the skills, the harness and the models together: the pipeline from [Orchestration](./lab-12-orchestration.md) builds a few fixed features, unattended, and each result is graded against tests and criteria the agents never saw. They are slow and cost real money.

| Term | What it means |
| --- | --- |
| **Case** | A skill-loaded eval: a prompt, written the way a developer would ask, and whether the skill should load for it. |
| **Task** | An eval of the whole setup: a feature request, the commit its app code starts from, hidden acceptance tests and hidden criteria. |
| **Runs** | Agent output varies from run to run, so every case and every task runs three times. |
| **Grader** | What decides whether a run counts. For a case, plain code that reads the agent's tool calls. For a task, the hidden tests and the `review` skill from Lab 12, with the hidden criteria. |

Both directions count for a skill. A skill that doesn't load when it should is a bug. A skill that loads when it shouldn't fills the context with rules that don't apply.

## Your Task

Start the lab setup with the following command:

```bash
task lab/evals
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/evals`.
>
> [![Open Lab 13 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fevals)

The skill-loaded evals check, for a few typical prompts, whether the agent loads the right skills, and leaves out the ones that don't apply. Every skill keeps its prompts next to its `SKILL.md`, in `skill-loaded-evals.json`:

<details>
<summary>The cases of <code>testing</code> and <code>api-design</code></summary>

::: code-group

```json [.agents/skills/testing/skill-loaded-evals.json]
[
  { "prompt": "Add an endpoint that returns all flights of one airline.", "loads": true },
  { "prompt": "The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.", "loads": true },
  { "prompt": "Fix the typos in README.md.", "loads": false },
  { "prompt": "Add a task to Taskfile.yml that prints the Java version.", "loads": false },
  { "prompt": "Explain how DelaysController computes the delay of a flight.", "loads": false }
]
```

```json [.agents/skills/api-design/skill-loaded-evals.json]
[
  { "prompt": "Add an endpoint that returns all flights of one airline.", "loads": true },
  { "prompt": "Add paging to GET /delays.", "loads": true },
  { "prompt": "The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.", "loads": false },
  { "prompt": "Fix the typos in README.md.", "loads": false }
]
```

:::

None of the prompts mentions tests or a skill. Some prompts appear in both files: every skill is checked on its own.

</details>

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token). The skill-loaded evals read Claude Code's tool calls, so they run with Claude Code, also when you use Copilot for the rest.

In **terminal 1**, start Temporal and the worker, and open `flows watch`:

```bash
task flows:start
task flows:watch
```

This branch has `.harness/evals/`, so `flows watch` now has a third tab, **Evals**. Use **terminal 2** for the steps below.

### 1. Run the skill-loaded evals

```bash
flows skill-loaded-evals
```

After a minute or two, you get one block per skill, with one line per case: did it pass, and in how many runs did the agent load the skill:

```text
== api-design: 4 of 4 cases pass
PASS  should load      loaded in 3 of 3 runs  Add an endpoint that returns all flights of one airline.
PASS  should load      loaded in 3 of 3 runs  Add paging to GET /delays.
...
== testing: 5 of 5 cases pass
PASS  should load      loaded in 3 of 3 runs  Add an endpoint that returns all flights of one airline.
PASS  should load      loaded in 2 of 3 runs  The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.
PASS  shouldn't load   loaded in 0 of 3 runs  Fix the typos in README.md.
...
9 cases passed, 0 failed. Cost $0.85.
Results: .harness/evals/results/20261017-101500/
```

All cases should pass. In `flows watch`, press `Tab` until you see **Evals**, and `→` to **Skill loaded**: the run you just did is a column there, every case a row.

Here's the workflow:

::: code-group

```ts [.harness/src/workflows/skill-loaded-evals.ts]
import { isCancellation, setHandler } from '@temporalio/workflow';
import type { SkillLoadedEvalInput, SkillLoadedEvalReport, SkillLoadedEvalResult, SkillLoadedEvalRun, SkillLoadedEvalsStatus } from '../types/skill-loaded-evals';
import { asExpected } from '../types/skill-loaded-evals';
import { describeSkillSetup, listSkillLoadedEvalCases, loadsSkill, writeSkillReport } from './activities';
import { failureMessage } from './failure';
import { propose } from './improve';
import { skillLoadedEvalsStatus } from './signals';
import { addCost } from './usage';

// Runs every case three times, because agent output varies from run to run. A case passes when
// most runs do what it expects. All runs start at once. Writes the report to .harness/evals/results/.
export async function skillLoadedEvals({ repoDir, agent, evalsId }: SkillLoadedEvalInput): Promise<SkillLoadedEvalReport> {
  const startedAt = new Date().toISOString(); // the workflow's clock: the same on every replay
  // The cases from every .agents/skills/<skill>/skill-loaded-evals.json
  const cases = await listSkillLoadedEvalCases(repoDir);
  const status: SkillLoadedEvalsStatus = { evalsId, step: 'running', runs: cases.length * 3, done: 0, asExpected: 0 };
  setHandler(skillLoadedEvalsStatus, () => status);
  const setup = await describeSkillSetup(repoDir);
  let model: string | undefined;

  // One run of a case. A run that keeps failing is a run that didn't do what the case expects, the others still count.
  const once = async (skill: string, prompt: string, loads: boolean): Promise<SkillLoadedEvalRun> => {
    let run: SkillLoadedEvalRun;
    try {
      const load = await loadsSkill(repoDir, skill, prompt);
      model ??= load.model;
      run = { loaded: load.loaded, costUsd: load.costUsd };
      status.costUsd = addCost(status.costUsd, load.costUsd);
    } catch (err) {
      if (isCancellation(err)) throw err;
      run = { failure: failureMessage(err) };
    }
    status.done++;
    if (asExpected(run, loads)) status.asExpected++;
    return run;
  };

  const results: SkillLoadedEvalResult[] = await Promise.all(
    cases.map(async ({ skill, prompt, loads }) => {
      const runs = await Promise.all([1, 2, 3].map(() => once(skill, prompt, loads)));
      const loaded = runs.filter((run) => run.loaded).length;
      const expected = runs.filter((run) => asExpected(run, loads)).length;
      return { skill, prompt, loads, runs, loaded, pass: expected >= 2 };
    }),
  );

  const costUsd = status.costUsd === undefined ? 0 : status.costUsd; // no runs, no cost
  const report: SkillLoadedEvalReport = { evalsId, startedAt, ...setup, results, costUsd, model };
  await writeSkillReport(repoDir, report);

  // Failing cases: the improve agent proposes skill descriptions. The pipeline can't change the skills, you do.
  const failing = results.filter((result) => !result.pass);
  if (failing.length === 0) return report;
  status.step = 'writing proposals';
  report.proposals = await propose(repoDir, agent, 'skill-loaded evals', evalsId);
  await writeSkillReport(repoDir, report);
  return report;
}
```

```ts [.harness/src/activities/agent.ts (excerpt)]
// One short, read-only agent run: does Claude Code load the skill for this prompt? It only needs its
// first few turns to decide, so it stops after ten. It always runs claude, also with AGENT=copilot: its
// stream-json output shows the tool calls that load a skill.
export async function loadsSkill(repoDir: string, skill: string, prompt: string): Promise<SkillLoad> {
  const sandbox = await readFile(path.join(repoDir, '.harness/sandbox/no-network.json'), 'utf8');
  const { output } = await exec(repoDir, 'claude', [
    '-p', prompt,
    '--tools', 'Read,Grep,Glob,Skill',
    '--max-turns', '10',
    '--output-format', 'stream-json', '--verbose', // one JSON event per line, tool calls included
    '--strict-mcp-config', '--settings', sandbox,
  ], { quiet: true });
  // The exit code is 1 when the agent used up its turns, so look for the final result event instead
  const run = parseStream(output);
  if (!run) throw ApplicationFailure.retryable('claude stopped without a result');

  const toolCalls = events(output)
    .flatMap((event) => event.message?.content ?? [])
    .filter((block) => block.type === 'tool_use');

  // The agent loads a skill through the Skill tool, or by reading its SKILL.md
  const loaded = toolCalls.some(({ name, input }) =>
    (name === 'Skill' && input.skill === skill) ||
    (name === 'Read' && input.file_path?.endsWith(`skills/${skill}/SKILL.md`)));
  return { loaded, costUsd: run.costUsd, model: run.model };
}
```

:::

Two things to notice:

- **There is no judge.** Whether a skill was loaded is a fact in the tool calls, so code checks it. That's faster, cheaper, and gives the same answer every time. Use an agent as a judge only for what code can't check.
- **The runs are short and read-only.** The eval only needs the agent's decision, not the code it would write, so it stops the agent after ten turns.

### 2. Make the description too broad

Now change the description the way people often do when a skill doesn't load often enough: make it apply to everything. Open `.agents/skills/testing/SKILL.md` and replace the `description` line with:

```markdown
description: Use for every task in this repository.
```

The skill-loaded evals check your checkout as it is, so there's no need to commit. Run them again:

```bash
flows skill-loaded-evals
```

The cases that should load `testing` still pass. But the ones that shouldn't now fail, for example:

```text
== api-design: 4 of 4 cases pass
...
== testing: 2 of 5 cases pass
...
FAIL  shouldn't load   loaded in 3 of 3 runs  Fix the typos in README.md.
FAIL  shouldn't load   loaded in 3 of 3 runs  Add a task to Taskfile.yml that prints the Java version.
...
6 cases passed, 3 failed. Cost $0.90.
Checked with changes not committed: .agents/skills/testing/SKILL.md

The improve agent proposes, for the failing cases:
...
```

Only `testing` broke: `api-design` still passes. And because cases failed, the **improve agent** read the results, and the ones of the evals before, and proposes a description that makes the failing cases pass without breaking the others. In `flows watch`, press `p` in the Evals tab to read the proposal.

A failing eval doesn't become a ticket for a Ralph loop: since Lab 10, no agent may change `.agents/`. The skills are what the agents follow and get judged by, so a change to them is yours to make. The improve agent only proposes.

Undo your change before you go on:

```bash
git checkout .agents/skills/testing/SKILL.md
```

> [!NOTE]
> An eval is only as good as its cases. When a skill doesn't load in real use, add that prompt to its `skill-loaded-evals.json`, so the description can't break the same way twice.

### 3. Grade the whole setup

A skill that loads can still lead to bad code. Whether the setup builds features you would ship is a question for the whole pipeline. Each task is a folder in `.harness/evals/tasks/<id>/`:

- `request.md`: the feature request, what the pipeline gets.
- `base`: the commit its app code starts from.
- `accept/`: the hidden acceptance tests, laid out like the repository.
- `criteria.md`: what the grader checks.

<details>
<summary>The task <code>min-delay-filter</code></summary>

::: code-group

```markdown [request.md]
Support staff want to see only the flights that are seriously delayed. `GET /delays` should accept a
`min_delay` parameter, in minutes, and then return only the flights whose current delay is at least that
long. It works together with the existing `airline_code` filter. Flights that are on time or cancelled
have no delay, so they are left out when `min_delay` is given. If no flight is delayed that long, the
answer is an empty list, not an error. A `min_delay` that is negative or not a number is a bad request.
```

```markdown [criteria.md]
- `GET /delays?min_delay=<minutes>` returns only the flights whose latest delay event has a delay of at
  least that many minutes. On-time and cancelled flights are left out.
- The filter is applied to the flight's latest delay event, the same one `GET /delays` shows, not to any
  earlier event.
- `min_delay` works together with `airline_code`.
- No flight delayed that long gives `200` with an empty list. An unknown `airline_code` still gives `404`.
- A negative `min_delay`, or one that isn't a number, gives `400`.
- Without `min_delay`, `GET /delays` answers exactly as before.
- Tests cover the filter, the combination with `airline_code`, the empty result, and both bad requests.
```

:::

</details>

Each run works in a copy of your repository under `~/.flows/evals/`, with the skills and the harness of your last commit and the task's app code, and runs the pipeline unattended: nobody approves the tickets or decides the merge. A run is **accepted** when its pipeline merged something, `task test` passes with the hidden tests added, and the grader would ship it. The pipeline's own judges and its review don't grade: they belong to the setup under test.

A full pipeline run costs a few dollars, so start with one task:

```bash
flows evals min-delay-filter
```

It says what the runs will cost, by the evals before, and asks before it starts. At most 3 runs work at the same time. The runs show up in the Evals tab while they work. At the end, it prints three numbers, for example:

```text
min-delay-filter  ✓ ✓ ✗

Not accepted:
  min-delay-filter run 3: the grader rejects it: no test covers a min_delay that isn't a number (change-quality, item 2)

Quality      2 / 3 runs accepted
Reliability  0 / 1 tasks with every run accepted
First time   1 / 3 runs accepted without a judge or a test rejecting a step
Cost         $4.10 per accepted change, $8.20 in total
```

- **Quality**: the runs accepted, of all runs.
- **Reliability**: the tasks whose 3 runs were all accepted. Only these are candidates for unattended work.
- **Cost per accepted change**: what all runs cost, the ones not accepted too, divided by the accepted ones.
- **First time right**: accepted, and no judge or test rejected a step on the way. A run that got there after a rejection counts for Quality, but cost more.

For the runs that weren't right the first time, the improve agent proposes changes to the skills or the harness, as rules for any feature request, never for one task: a fix for one task only games the evals. Read them with `p` in the Evals tab, and `⏎` on a run shows why it was or wasn't accepted, and what the grader said.

The Evals tab keeps the trend: every evals is a column, so after you change a skill, the next evals shows whether it helped. A change within noise is dimmed: 5 tasks of 3 runs are few. Evals whose models differ from the one before are marked with `*`: `opus` and `sonnet` always resolve to the latest version, so a new model release changes the setup without a commit.

> [!IMPORTANT]
> The evals grade what's committed. Commit a skill change before you start them, or the runs won't see it. `flows evals --stop` stops a running evals: the runs that finished keep their results.
