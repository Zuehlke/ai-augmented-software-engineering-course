# Lab 6 · Automated feedback loops

## Context

As we know, usage of skills and instructions is not deterministic.

For verification harnesses we want deterministic checks via hooks, not only probabilistic behavior.

## Your Task

Start the lab setup with the following command:

```bash
task lab/hook
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/hook`.
>
> [![Open Lab 6 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fhook)

> [!WARNING]
> The GitHub Copilot plugin for **IntelliJ** doesn't support all hooks. If you work in IntelliJ, use the preinstalled **GitHub Copilot CLI** for this lab.

After the command is finished, complete the following tasks:

- Update the hook in `verification-harness.json` to make sure tests are run whenever the agent stops.
- Open a new chat and verify that tests are being executed. Currently a test is failing, note the behavior of your agent.

> [!NOTE]
> The `TODO` markers in the relevant files will help you get started.

## Solution

<details>
<summary><code>.github/hooks/verification-harness.json</code></summary>

```json
{
  "hooks": {
    "agentStop": [
      {
        "type": "command",
        "bash": "out=$(task test 2>&1) || { echo \"$out\" >&2; exit 2; }",
        "powershell": "$out = task test 2>&1 | Out-String; if ($LASTEXITCODE -ne 0) { [Console]::Error.Write($out); exit 2 }"
      }
    ]
  }
}
```

</details>

> [!NOTE]
> For Claude Code, put the equivalent hook in `.claude/settings.json`.
> The JSON shape is different: Claude Code uses `hooks.Stop` entries with nested command hooks, for example:
>
> ```json
> {
>   "hooks": {
>     "Stop": [
>       {
>         "hooks": [
>           {
>             "type": "command",
>             "command": "task test"
>           }
>         ]
>       }
>     ]
>   }
> }
> ```
