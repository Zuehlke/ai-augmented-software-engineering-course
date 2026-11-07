# Lab 13 · Evals

## Context

Agents fail quietly. Change a skill's `description` and the agent may stop loading it, or load it for everything. Nothing crashes: the results just get worse.

Evals catch this after every change. They are the tests of your harness: the skills, the prompts and the judges. In this lab, you change a skill's description and check with an eval that the agent still loads it when it should, and only then.

The evals run with [promptfoo](https://www.promptfoo.dev/), an open-source eval tool.

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
> The evals need the [agent token from the setup](/getting-started/setup#agent-token). They run with Claude Code, also if you use Copilot otherwise. Outside the dev container, they need Node.js 22.22 or newer.

### 1. Run the skill-loaded eval

Each skill's cases are in `.harness/evals/skill-loaded/<skill>.yaml`: a prompt, and whether the skill should load for it.

<details>
<summary>The cases of <code>testing</code></summary>

```yaml [.harness/evals/skill-loaded/testing.yaml]
- description: "testing should load: Add an endpoint that returns all flights of one airline."
  vars: { skill: testing, loads: true, prompt: Add an endpoint that returns all flights of one airline. }
- description: "testing should load: The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it."
  vars: { skill: testing, loads: true, prompt: The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it. }
- description: "testing should load: Make the airline_code filter of GET /delays ignore spaces around the code."
  vars: { skill: testing, loads: true, prompt: Make the airline_code filter of GET /delays ignore spaces around the code. }
- description: "testing near miss, should not load: Explain how DelaysController computes the delay of a flight."
  vars: { skill: testing, loads: false, prompt: Explain how DelaysController computes the delay of a flight. }
- description: "testing near miss, should not load: Add a section to README.md that explains how to run the tests."
  vars: { skill: testing, loads: false, prompt: Add a section to README.md that explains how to run the tests. }
- description: "testing near miss, should not load: Add a task to Taskfile.yml that prints the Java version."
  vars: { skill: testing, loads: false, prompt: Add a task to Taskfile.yml that prints the Java version. }
- description: "testing near miss, should not load: Fix the typos in README.md."
  vars: { skill: testing, loads: false, prompt: Fix the typos in README.md. }
```

None of the prompts mentions a skill. The ones that shouldn't load it are near misses: they are about Java code or tests, but change no Java behavior.

</details>

Run the eval:

```bash
task evals:skills
```

It runs the 25 cases of four skills, each 3 times, because agents don't do the same thing every time. In our run, that took 6 minutes and cost $10.56. It ends with one line per case, a `✓` or `✗` per run:

```text
Cases, the runs of each:
  ✓✓✓  testing should load: Add an endpoint that returns all flights of one airline.
  ✓✓✓  testing should load: The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.
  ✓✓✓  testing should load: Make the airline_code filter of GET /delays ignore spaces around the code.
  ✓✓✓  testing near miss, should not load: Explain how DelaysController computes the delay of a flight.
  ✓✓✓  testing near miss, should not load: Add a section to README.md that explains how to run the tests.
  ✓✓✓  testing near miss, should not load: Add a task to Taskfile.yml that prints the Java version.
  ✓✓✓  testing near miss, should not load: Fix the typos in README.md.
  …
pass@k 25 of 25 cases, pass^k 25 of 25, 1 runs failed with an error
```

A run that failed with an error, here one that used up its 10 turns, shows as `E`. It says nothing about the case and doesn't count.

- **pass@k**: the cases with at least one right run.
- **pass^k**: the cases with every run right. Only these are reliable.

Open the results in promptfoo's web view, on [http://localhost:15500](http://localhost:15500):

```bash
task evals:view
```

<FlowsWatch scene="lab13-skills" title="localhost:15500 — promptfoo" />

Besides pass/fail, promptfoo shows two shares of right runs:

- **loads when it should**: low when a description is too narrow.
- **stays out when it shouldn't**: low when a description is too broad.

There is no judge: plain code checks the agent's tool calls for whether the skill loaded. That's fast, cheap and repeatable.

### 2. Make the description too broad

When a skill doesn't load often enough, people often make it apply to everything. Try it: in `.agents/skills/testing/SKILL.md`, replace the `description` line with:

```markdown
description: Use for every task in this repository.
```

The eval checks your checkout as it is, so there's no need to commit. Run it again, only for the cases of `testing`, which saves time and credits:

```bash
task evals:skills -- --filter-pattern '^testing'
```

```text
Cases, the runs of each:
  ✓✓✓  testing should load: Add an endpoint that returns all flights of one airline.
  ✓✓✓  testing should load: The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.
  ✓✓✓  testing should load: Make the airline_code filter of GET /delays ignore spaces around the code.
  ✗✗✗  testing near miss, should not load: Explain how DelaysController computes the delay of a flight.
  ✗✗✗  testing near miss, should not load: Add a section to README.md that explains how to run the tests.
  ✗✗✗  testing near miss, should not load: Add a task to Taskfile.yml that prints the Java version.
  ✗✗✗  testing near miss, should not load: Fix the typos in README.md.
pass@k 3 of 7 cases, pass^k 3 of 7
```

You see the same in the web view: reload it, and open the newest eval.

<FlowsWatch scene="lab13-too-broad" title="localhost:15500 — promptfoo" />

All four near misses fail now: **stays out when it shouldn't** drops to 0%. The cases that should load `testing` still pass, so without the near misses, the eval would never have noticed.

### 3. Write a better description

A good description says **what** the skill does and **when** to use it. Write one for `testing` that brings both shares back, and run the eval again until every case passes.

<details>
<summary>One description that passes</summary>

```markdown
description: Write tests first for changes to the Java code in src/. Use when a task adds or changes Java behavior, like a new endpoint, a feature or a bug fix. Not for docs, build files or explaining code.
```

```text
Cases, the runs of each:
  ✓✓✓  testing should load: Add an endpoint that returns all flights of one airline.
  ✓✓✓  testing should load: The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.
  ✓✓✓  testing should load: Make the airline_code filter of GET /delays ignore spaces around the code.
  ✓✓✓  testing near miss, should not load: Explain how DelaysController computes the delay of a flight.
  ✓✓✓  testing near miss, should not load: Add a section to README.md that explains how to run the tests.
  ✓✓✓  testing near miss, should not load: Add a task to Taskfile.yml that prints the Java version.
  ✓✓✓  testing near miss, should not load: Fix the typos in README.md.
pass@k 7 of 7 cases, pass^k 7 of 7
```

<FlowsWatch scene="lab13-fixed" title="localhost:15500 — promptfoo" />

</details>

> [!NOTE]
> When a skill doesn't load in real use, add that prompt to its `.harness/evals/skill-loaded/<skill>.yaml`, so it can't break the same way twice. `task evals:lint`, free and fast, checks that every skill has cases of both kinds.
