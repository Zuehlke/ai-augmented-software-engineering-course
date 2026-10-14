# Lab 13 · Evals

## Context

A skill only helps when the agent loads it. Nobody types "use the testing skill" in a real session: the agent reads every skill's `description` and decides on its own. If someone rewrites a description, renames a skill, or adds a new one that overlaps, the agent may quietly stop loading it. Nothing fails. The agent just writes code without the tests the skill asks for.

Trying it once by hand doesn't catch that. An **eval** does it automatically, after every change. This one checks whether the agent loads the skills from the earlier labs when it should, and only then:

| Term | What it means |
| --- | --- |
| **Case** | A prompt, written the way a developer would ask, and whether the skill should load for it. |
| **Grader** | Plain code that reads the agent's tool calls and checks if it loaded the skill. No agent judges anything. |
| **Runs** | Agent output varies from run to run, so every case runs three times. It passes when most runs do what the case expects. |

Both directions count. A skill that doesn't load when it should is a bug. A skill that loads when it shouldn't fills the context with rules that don't apply.

## Your Task

Start the lab setup with the following command:

```bash
task lab/evals
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/evals`.
>
> [![Open Lab 13 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fevals)

The eval checks, for a few typical prompts, whether the agent loads the right skills, and leaves out the ones that don't apply. Every skill keeps its prompts next to its `SKILL.md`, in `evals.json`:

<details>
<summary>The cases of <code>testing</code> and <code>api-design</code></summary>

::: code-group

```json [.agents/skills/testing/evals.json]
[
  { "prompt": "Add an endpoint that returns all flights of one airline.", "loads": true },
  { "prompt": "The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.", "loads": true },
  { "prompt": "Fix the typos in README.md.", "loads": false },
  { "prompt": "Add a task to Taskfile.yml that prints the Java version.", "loads": false },
  { "prompt": "Explain how DelaysController computes the delay of a flight.", "loads": false }
]
```

```json [.agents/skills/api-design/evals.json]
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
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token). This eval reads Claude Code's tool calls, so it runs with Claude Code only.

In **terminal 1**, start Temporal and the worker, and follow the worker's output:

```bash
task flows:start
flows logs
```

Use **terminal 2** for the steps below.

### 1. Run the eval

```bash
flows eval
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
9 cases passed, 0 failed.
```

All cases should pass.

Here's the workflow:

::: code-group

```ts [.harness/flows/src/workflows/evals.ts]
import type { EvalInput, EvalReport, EvalResult } from '../shared';
import { listEvalCases, loadsSkill } from './activities';
import { plan } from './plan';

// Runs every case three times, because agent output varies from run to run. A case passes when
// most runs do what it expects. All runs start at once.
export async function evals({ repoDir, agent }: EvalInput): Promise<EvalReport> {
  // The cases from every .agents/skills/<skill>/evals.json
  const cases = await listEvalCases(repoDir);

  const results: EvalResult[] = await Promise.all(
    cases.map(async ({ skill, prompt, loads }) => {
      const runs = await Promise.all([1, 2, 3].map(() => loadsSkill(repoDir, skill, prompt)));
      const loaded = runs.filter(Boolean).length;
      return { skill, prompt, loads, loaded, pass: loads ? loaded >= 2 : loaded <= 1 };
    }),
  );

  // A failing eval becomes a ticket, like any other bug: the plan agent writes it with the slice skill
  const failing = results.filter((result) => !result.pass);
  if (failing.length === 0) return { results, tickets: [] };
  const request = `flows eval fails. Fix the skill descriptions in .agents/skills/, so that these cases pass:
${failing.map(({ skill, prompt, loads }) => `- ${skill} should ${loads ? '' : 'not '}load for: ${prompt}`).join('\n')}`;
  return { results, tickets: await plan({ repoDir, agent, request }) };
}
```

```ts [.harness/flows/src/activities/agent.ts (excerpt)]
// One short, read-only agent run: does the agent load the skill for this prompt? It only needs its
// first few turns to decide, so it stops after ten.
export async function loadsSkill(repoDir: string, skill: string, prompt: string): Promise<boolean> {
  const sandbox = await readFile(path.join(repoDir, '.harness/sandbox/no-network.json'), 'utf8');
  const { output } = await exec(repoDir, 'claude', [
    '-p', prompt,
    '--tools', 'Read,Grep,Glob,Skill',
    '--max-turns', '10',
    '--output-format', 'stream-json', '--verbose', // one JSON event per line, tool calls included
    '--strict-mcp-config', '--settings', sandbox,
  ], { quiet: true });
  // The exit code is 1 when the agent used up its turns, so look for the final result event instead
  if (!output.includes('"type":"result"')) throw ApplicationFailure.retryable('claude stopped without a result');

  const toolCalls = output
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => JSON.parse(line).message?.content ?? [])
    .filter((block) => block.type === 'tool_use');

  // The agent loads a skill through the Skill tool, or by reading its SKILL.md
  return toolCalls.some(({ name, input }) =>
    (name === 'Skill' && input.skill === skill) ||
    (name === 'Read' && input.file_path?.endsWith(`skills/${skill}/SKILL.md`)));
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

Commit the change. A failing eval becomes a ticket, and the tickets can only come onto your branch if it has no uncommitted changes:

```bash
git commit -am "Make the testing skill apply to everything"
```

Run the eval again:

```bash
flows eval
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
6 cases passed, 3 failed.
The plan agent wrote TICKET-5 for the failing cases, see backlog/.
```

Only `testing` broke: `api-design` still passes. And because cases failed, the workflow handed them to the plan agent from Lab 9: a failing eval becomes a ticket, like any other bug. Open the ticket in `backlog/`: is it one `ready` ticket, with acceptance criteria you could check?

> [!NOTE]
> An eval is only as good as its cases. When a skill doesn't load in real use, add that prompt to its `evals.json`, so the description can't break the same way twice.
