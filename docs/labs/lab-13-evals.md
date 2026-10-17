# Lab 13 · Evals

## Context

A skill only helps when the agent loads it. Nobody types "use the testing skill" in a real session: the agent reads every skill's `description` and decides on its own. If someone rewrites a description, renames a skill, or adds a new one that overlaps, the agent may quietly stop loading it. Nothing fails. The agent just writes code without the tests the skill asks for.

Trying it once by hand doesn't catch that. An **eval** does it automatically, after every change. This lab has two:

- The **skill-loaded evals** check whether the agent loads the skills from the earlier labs when it should, and only then. They take a few minutes and cost about $5.
- The **end-to-end evals** grade the whole setup, the skills, the harness and the models together: the pipeline from [Orchestration](./lab-12-orchestration.md) builds a few fixed features, unattended, and each result is graded against tests and criteria the agents never saw. They are slow, and they cost real money: this lab shows them, but you won't run them.

For the skill-loaded evals, both directions count. A skill that doesn't load when it should is a bug. A skill that loads when it shouldn't fills the context with rules that don't apply.

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
> The skill-loaded evals run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token). They read Claude Code's tool calls, so they run with Claude Code, also when you use Copilot for the rest. A run of all cases costs about $5.

In **terminal 1**, start Temporal and the worker, and open `flows watch`:

```bash
task flows:start
task flows:watch
```

### 1. Run the skill-loaded evals

<FlowsWatch scene="lab13-skills" />

This branch has `.harness/evals/`, so `flows watch` has a third tab now. Press `Tab` until you see **Evals**. It opens on **E2E**, the end-to-end evals: press `→` to switch to **Skill loaded**.

Press `s`. The dialog says what runs: every case 3 times, 27 runs, and what that will cost, by the last skill-loaded evals. The first time, it can't know yet. Press `Enter` to start.

All runs start at once, so it takes a few minutes. When they're done, you see one row per case and one `✓` per run that did what the case expects. `not:` marks a prompt the skill shouldn't load for. A case passes when at least 2 of its 3 runs do, so a single `✗` is fine: agent output varies from run to run. Every case should pass. Pick a run with the arrow keys and press `Enter` to see what it did.

Above the grid, the **trend** has one column per skill-loaded evals, with the commit it checked. It grows with every run, so you see when a change to a skill broke something.

Two things to notice about how it checks:

- **There is no judge.** Whether a skill was loaded is a fact in the tool calls, so code checks it. That's faster, cheaper, and gives the same answer every time. Use an agent as a judge only for what code can't check.
- **The runs are short and read-only.** The eval only needs the agent's decision, not the code it would write, so it stops the agent after ten turns.

### 2. Make the description too broad

<FlowsWatch scene="lab13-proposals" />

Now change the description the way people often do when a skill doesn't load often enough: make it apply to everything. Open `.agents/skills/testing/SKILL.md` and replace the `description` line with:

```markdown
description: Use for every task in this repository.
```

The skill-loaded evals check your checkout as it is, so there's no need to commit. In the Evals tab, press `s` again: the dialog notes that `.agents/skills/testing/SKILL.md` isn't committed, and checks it as it is. Press `Enter`.

The trend gets a second column, and it drops: the cases that should load `testing` still pass, but the three that shouldn't now fail in every run. `api-design` still passes: every skill is checked on its own.

Because cases failed, one more agent runs at the end: the **improve agent**. It reads the results, and the ones of the skill-loaded evals before, and proposes a description that makes the failing cases pass without breaking the others. Press `p` to read the proposal.

A failing eval doesn't become a ticket for a Ralph loop: since Lab 10, no agent may change `.agents/`. The skills are what the agents follow and get judged by, so a change to them is yours to make. The improve agent only proposes.

Undo your change before you go on:

```bash
git checkout .agents/skills/testing/SKILL.md
```

> [!NOTE]
> An eval is only as good as its cases. When a skill doesn't load in real use, add that prompt to its `skill-loaded-evals.json`, so the description can't break the same way twice.

### 3. The end-to-end evals

A skill that loads can still lead to bad code. Whether the setup builds features you would ship is a question for the whole pipeline. The **end-to-end evals** answer it on a few fixed tasks. Each task is a folder in `.harness/evals/tasks/<id>/`:

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

Each run works in a copy of your repository under `~/.flows/evals/`, with the skills and the harness of your last commit and the task's app code, and runs the pipeline from Lab 12 unattended: nobody approves the tickets or decides the merge. A run is **accepted** when its pipeline merged something, `task test` passes with the hidden tests added, and the grader would ship it. The pipeline's own judges and its review don't grade: they belong to the setup under test.

> [!CAUTION]
> Don't start the end-to-end evals unless you have (almost) unlimited credits. Every run is a whole pipeline: research, plan, the Ralph loops with their judges, the review and the grader. In our runs, one task, 3 runs, cost $5 to $16, and all 5 tasks, 15 runs, cost $58.64 and took about 18 minutes per run.

<FlowsWatch scene="lab13-e2e-start" />

To see what you would start, press `←` in the Evals tab to switch back to **E2E**, and `s`. You pick all tasks or one of them, and the dialog says how many runs that is. The cost is unknown until an end-to-end evals has run: then it estimates by the cost per run of the last one. Press `Esc` to close it without starting anything.

Here is one of our end-to-end evals, all 5 tasks:

<FlowsWatch scene="lab13-e2e-results" />

While it runs, at most 3 runs work at the same time, and the box shows each one's step and what they cost so far. When it's done, the trend has four numbers:

- **Quality, runs accepted**: 8 of 15.
- **Reliability, tasks**: the tasks whose 3 runs were all accepted, 1 of 5. Only these are candidates for unattended work.
- **First time right**: accepted, and no judge or test rejected a step on the way. Only 1 of 15: most accepted runs got there after a rejection, and paid for it.
- **Cost per accepted**: what all runs cost, the ones not accepted too, divided by the accepted ones: $7.33.

> [!TIP]
> Everything in the Evals tab also works from the command line: `flows skill-loaded-evals`, `flows evals [task]` for the end-to-end evals, and `flows evals --stop` to stop running end-to-end evals. The results go to `.harness/evals/results/`, not committed.
