# Lab 13 · Evals

## Context

Agents fail quietly. Change a skill's `description` and the agent may stop loading it. Change a skill or the harness and the pipeline may build worse code. Nothing crashes: the results just get worse.

Evals catch this after every change. This lab has two kinds:

- Skill-loaded evals check that the agent loads each skill when it should. They take a few minutes.
- End-to-end evals let the pipeline from [Orchestration](./lab-12-orchestration.md) build fixed features, and grade the results against hidden tests. They are slow and expensive, so you only look at their results.

## Your Task

Start the lab setup with the following command:

```bash
task lab/evals
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/evals`.
>
> [![Open Lab 13 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fevals)

> [!NOTE]
> The skill-loaded evals need the [agent token from the setup](/getting-started/setup#agent-token). They run with Claude Code, also if you use Copilot otherwise.

Start Temporal and the worker, and open `flows watch` on [http://localhost:8234](http://localhost:8234):

```bash
task flows:start
task flows:watch
```

### 1. Run the skill-loaded evals

Each skill keeps its cases in `skill-loaded-evals.json`, next to its `SKILL.md`: a prompt, and whether the skill should load for it.

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

None of the prompts mentions a skill. Each skill is checked on its own, so some prompts appear in both files.

</details>

Click **Evals**, the tab this branch adds. **Skill loaded** is selected: click **Start skill-loaded evals**. It runs every case 3 times, 27 runs.

<FlowsWatch scene="lab13-skills" />

After a few minutes, you see one row per case, with what each of its runs did, and a `✗` for each run that didn't do what the case expects. `should not load` marks a prompt the skill shouldn't load for. A case passes when 2 of its 3 runs do, and every case should pass. The trend at the top adds a bar each time you run the evals, so you see when a change breaks something.

There is no judge: plain code checks the agent's tool calls for whether the skill loaded. That's fast, cheap and repeatable.

### 2. Make the description too broad

When a skill doesn't load often enough, people often make it apply to everything. Try it: in `.agents/skills/testing/SKILL.md`, replace the `description` line with:

```markdown
description: Use for every task in this repository.
```

Skill-loaded evals check your checkout as it is, so there's no need to commit. Click **Run again**.

<FlowsWatch scene="lab13-proposals" />

The trend drops to 6 of 9: the three cases that shouldn't load `testing` now fail. `api-design` still passes.

Because cases failed, an improve agent proposes a better description. Click **Read the proposal** to read it. Applying it is up to you: agents may not change `.agents/`.

<details>
<summary><code>.agents/skills/improve/SKILL.md</code>, the skill the improve agent uses</summary>

````markdown
---
name: improve
description: After an evals run, read its results and the earlier ones, and propose changes to the skills and the harness for a human to make. Changes no file.
disable-model-invocation: true
---

## TASK

An evals run just ran the setup, the skills in `.agents/skills/` and the harness in `.harness/src/`, and
some runs weren't right the first time. Propose the changes to the setup that would prevent that next
time. A human reads your proposals and makes the ones they agree with. Read any file you need, but
don't change any.

---

## WHERE

- `.harness/evals/results/<id>/` of the evals named below:
  - an e2e evals run has `evals.json` and one `<task>-<run>.json` per run. `rejectedBecause` lists why a
    judge or a check rejected a step, `reason` why the run wasn't accepted.
  - a skill-loaded evals run has `skill-loaded-evals.json`: the cases whose skill loaded when it shouldn't, or didn't
    when it should.
- The folders next to it are the earlier evals, the oldest first. The `proposals` in their report is
  what was proposed then, and their `skillsCommit` and `harnessCommit` say what the setup was.

---

## HOW

1. Group the reasons of this evals. Look at the earlier ones too: a reason that comes back across runs,
   tasks or evals is a gap in the setup. One that shows up once can be chance: say so, and don't
   propose a change for it alone.
2. Check the earlier proposals: if one was made (`git log` since that evals) and its reason is gone,
   it helped. If the reason is still there, say so, and propose something else.
3. For each gap, find where the setup lets it happen: the skill the agent followed, the judge's checks,
   or the prompts in `.harness/src/workflows/prompts.ts`. Read the file.
4. Propose the smallest change that closes the gap, as a rule that holds for any feature request. Never
   a rule about one task's domain, its hidden tests or its criteria: the evals' tasks stand for all
   work, and a fix for one of them only games the evals.
5. For a skill-loaded evals run: a skill loads by its `description`. Propose a description that makes the failing
   cases pass without breaking the ones that pass, in the skill's `skill-loaded-evals.json`.

---

## OUTPUT

Markdown, at most five proposals, the one that would help most first. Each one:

```
## <what to change, in a few words>

**Why:** <the reason that kept coming back, in which runs, and since which evals>
**File:** <path>
**Change:** <the text to add or replace, as it would be in the file>
```

If nothing comes back often enough to be more than chance, say that in one line instead.
````

</details>

Undo your change in a new terminal:

```bash
git checkout .agents/skills/testing/SKILL.md
```

> [!NOTE]
> When a skill doesn't load in real use, add that prompt to its `skill-loaded-evals.json`, so it can't break the same way twice.

### 3. The end-to-end evals

A skill that loads can still lead to bad code. End-to-end evals check whether the setup builds features you would ship, on a few fixed tasks. Each task is a folder in `.harness/evals/tasks/<id>/`.

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

Each run works in a copy of your repository, with your last commit and the task's app code, and runs the pipeline from Lab 12 unattended. It's **accepted** when something was merged, `task test` passes with the hidden tests, and the grader, the `review` skill with the hidden criteria, would ship it.

> [!CAUTION]
> Don't start the end-to-end evals unless you have (almost) unlimited credits. In our runs, one task (3 runs) cost $5 to $16, and all 5 tasks (15 runs) cost $58.64, at about 18 minutes per run.

<FlowsWatch scene="lab13-e2e-start" />

Here is one of our end-to-end evals, all 5 tasks:

<FlowsWatch scene="lab13-e2e-results" />

The results are summed up in four metrics:

- **Quality**: runs accepted, 8 of 15.
- **Reliability**: tasks with all 3 runs accepted, 1 of 5. Only these are candidates for unattended work.
- **First time right**: runs accepted without a rejected step on the way, 1 of 15.
- **Cost per accepted**: what all runs cost, divided by the accepted ones, $7.33.

> [!TIP]
> The Evals tab has command-line equivalents: `flows skill-loaded-evals`, `flows evals [task]` and `flows evals --stop`.
