# Lab 5 · Spec-Driven Development (SDD)

## Context

Instead of using your own research → design → implement workflow, make yourself familiar with [OpenSpec](https://github.com/Fission-AI/OpenSpec/), a publicly available SDD framework, and implement the same feature using its workflow.

OpenSpec keeps two folders: `openspec/specs/` describes how the system behaves today, and `openspec/changes/` holds the changes you are working on. Each step of the workflow is a slash command in your agent:

| Step | Where | Creates or changes |
| --- | --- | --- |
| `openspec init` | terminal: set up the project | `openspec/specs/` (empty at first), `openspec/changes/`, `openspec/config.yaml`, `.claude/skills/` and `.claude/commands/opsx/` |
| `/opsx:explore` | AI chat: optional | nothing, conversation only |
| `/opsx:propose <name>` | AI chat: draft the change | `changes/<name>/proposal.md`, `design.md`, `tasks.md` and `specs/<cap>/spec.md` |
| `/opsx:apply` | AI chat: implement the tasks | your source code, checkboxes ticked in `tasks.md` |
| `/opsx:sync` | AI chat: usually automatic | delta specs merged into `openspec/specs/<cap>/spec.md` |
| `/opsx:archive` | AI chat: finish the change | `changes/<name>/` moves to `changes/archive/YYYY-MM-DD-<name>/`, updates `specs/` if not yet synced |

## Your Task

Start the lab setup with the following command:

```bash
task lab/sdd
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/sdd`.
>
> [![Open Lab 5 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fsdd)

After the command is finished, complete the following tasks:

1. Install OpenSpec by passing this instruction to your agent:

   ```text
   Fetch https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/install.md and follow it.
   ```

2. Run `openspec init` in the terminal and check which files it created.
3. Optional: use `/opsx:explore` to think through the feature with the agent before you commit to a change.
4. Implement the same endpoint again using the OpenSpec workflow:
   - `GET /delays?airline_code=AA&limit=50`
   1. `/opsx:propose <name>` drafts the change. Read `proposal.md`, `design.md`, `tasks.md` and the spec: could the agent implement from them alone?
   2. `/opsx:apply` implements the tasks and ticks them off in `tasks.md`.
   3. `/opsx:sync` merges the change's delta specs into `openspec/specs/`. This usually happens automatically.
   4. `/opsx:archive` finishes the change and moves it to `openspec/changes/archive/`.

## Solution

After the change is archived, the repository contains:

- `openspec/specs/<cap>/spec.md`: how the delays endpoint behaves, now part of the current system spec
- `openspec/changes/archive/YYYY-MM-DD-<name>/`: the proposal, design, tasks and delta specs of the change
- the endpoint, its tests, and all checkboxes ticked in `tasks.md`
