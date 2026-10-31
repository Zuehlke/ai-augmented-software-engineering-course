# Lab 4 · Structured agentic workflows

## Context

In the last lab, the `research` skill turned a requirement into a specification. Now you add the two phases that follow, each as its own skill:

| Phase | Skill | Writes |
| --- | --- | --- |
| research | `research` | `specs/<slug>/specification.md`: what to build, with testable acceptance criteria |
| design | `design` | `specs/<slug>/design.md`: which modules, endpoints and tests change |
| implement | `implement` | the code, and `.harness/progress.md`: which criteria are met and which decisions were made |

## Your Task

Start the lab setup with the following command:

```bash
task lab/structured-workflow
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/structured-workflow`.
>
> [![Open Lab 4 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fstructured-workflow)

After the command is finished, complete the following tasks:

- Write the missing frontmatter for the `research`, `design` and `implement` skills.
- Implement the same endpoint again using the research → design → implement workflow, **each skill in a new session** (`/clear` or a new chat):
  - `GET /delays?airline_code=AA&limit=50`
- After each phase, read the file it wrote: could the next phase work from it alone?
- While `implement` runs, it writes its progress to `.harness/progress.md`.

> [!NOTE]
> The `TODO` markers in the relevant files will help you get started.

## Solution

<details>
<summary><code>.agents/skills/research/SKILL.md</code></summary>

```markdown
---
name: research
description: Critically review a requirement, surface gaps, refine requirements, and write an improved spec.
disable-model-invocation: true
---

## TASK

You are exploring and refining a requirement and writing an improved specification. Be concise, critical, and pragmatic.

The resulting specification must describe how the change should behave from an API/user perspective, and must not contain unnecessary implementation details.

The improved specification must be readable by both a human (for further refinement) and a coding agent (for implementation).

You MUST NOT make any code changes or offer to make any code changes as part of this task. This task is purely to refine the requirement.

---

## STEPS

1. Analyze the requirement based on the user’s prompt to make sure you understand it.
   - If necessary, read targeted parts of the codebase to understand current behavior from a user perspective.

2. Detect and list gaps or ambiguities (missing acceptance criteria, unclear ownership, implicit assumptions, vague terms, hidden dependencies, sequencing conflicts).

3. Ask the user at most the 5 highest-impact clarifying questions (only those that block correct implementation or carry high risk). Skip trivial questions.
   - If something is uncertain but non-critical, make and state a sensible assumption instead of asking.

4. Draft improved, implementation-ready requirements:
   - Title: the outcome, from the user's perspective
   - Context (1–2 sentences)
   - Acceptance Criteria (objectively testable, false at the current commit)
   - Constraints, Non-goals, Assumptions and Risks (if any)

5. Apply the **handoff-writing skill** to write the research-phase handoff, `specs/<slug>/specification.md`.

6. Output a short summary to the chat (not the file):
   - assumptions made
   - clarifications received

7. Ask the user for feedback and incorporate it into the handoff document in a follow-up pass.

---

## ASPECTS TO CONSIDER FOR API DESIGN

- What should the endpoint URLs be?
- What parameters should they accept?
- What response format should they return?
- What HTTP status codes should be used for different scenarios?
- How should this feature align with existing endpoints?
- What naming conventions should be followed?
- What response format patterns should be maintained?
- Are there any mathematical edge cases (e.g., division by zero, overflow)?

---

## PRIORITIZATION RULES

- Favor clarity over completeness; remove noise.
- Reject scope creep: if not traceable to the stated objective, ask the user for clarification.
- Ensure each acceptance criterion is objectively testable.
- Avoid solution bias unless mandated by constraints.

---

## ADDITIONAL RULES

If the user’s prompt is fundamentally insufficient, refuse to review it and ask the user to provide at least a minimal set of requirements.
```

</details>

<details>
<summary><code>.agents/skills/design/SKILL.md</code></summary>

```markdown
---
name: design
description: Turn a specification into a design that names the modules, endpoints and tests to change and how they integrate.
disable-model-invocation: true
---

## TASK

You are creating a design for the implementation of a requirement.

The design must be detailed enough to allow a human or less capable coding agent to implement it, but it should be as concise as possible to avoid overload.

Do not repeat the requirements — the implement phase reads the specification itself.

Focus on architectural building blocks:
- which modules to change
- which functions or endpoints to create or modify
- which tests must be written
- how components integrate

Do not include unnecessary code-level implementation details.

DO NOT refer to anything as “optional” or “not needed”. Clearly specify exactly which changes must be made, but do not write literal code.

You MUST NOT make any code changes or offer to make any code changes as part of this task. This task is purely to create a design document.

---

## ARCHITECTURAL REQUIREMENTS

- Must follow the repository coding guidelines.
- Must follow TDD methodology (tests before implementation).
- Must maintain 80% test coverage for new code.
- Must follow existing code patterns and conventions.
- Must handle all edge cases identified in requirements.

---

## STEPS

1. Read the specification in `specs/<slug>/specification.md`, where `<slug>` is a short kebab-case identifier for the feature or change.

2. Read and analyze the codebase to understand how the requirements can be implemented.
   - Do not rely solely on project overview knowledge.

3. If there are uncertainties:
   - Ask the user at most the **5 highest-impact clarifying questions**.
   - Only ask questions that block correct implementation or carry high risk.
   - Skip trivial questions.
   - If uncertainty is non-critical, make and document a sensible assumption.

4. Apply the **handoff-writing skill** to write the design-phase handoff, `specs/<slug>/design.md`.

5. Output a short summary to the chat (not the file):
   - assumptions made
   - clarifications received

6. Ask the user for feedback and integrate the feedback into the design document in a follow-up pass.

7. Do **not start implementation**. That's the implement phase, in a new session.
```

</details>

<details>
<summary><code>.agents/skills/implement/SKILL.md</code></summary>

```markdown
---
name: implement
description: Implement the design using TDD until every acceptance criterion is met, and record progress so a new session can continue.
disable-model-invocation: true
---

## TASK

You are implementing a design. You must follow the design document and work until all specified changes are implemented.

Your work is only done when:
- All acceptance criteria are met
- All tests (new and existing) pass successfully
- There are no quality check errors
- The code is properly formatted

---

## STEPS

1. Read the specification in `specs/<slug>/specification.md` to understand the acceptance criteria from a user perspective, where `<slug>` is a short kebab-case identifier for the feature or change.

2. Read the design in `specs/<slug>/design.md` to understand the implementation details.

3. If `.harness/progress.md` exists, an earlier session already started: continue from there, don't start over.

4. Implement the changes using TDD (tests before implementation).

5. Each time an acceptance criterion is met, apply the **handoff-writing skill** to update the implement-phase handoff, `.harness/progress.md`, so a new session could continue from it.

6. Iterate until all acceptance criteria are met and all test cases succeed.
   - YOU MUST NOT STOP until all quality checks succeed.

7. When every acceptance criterion is met, delete `.harness/progress.md`: the work is done, and the
   decisions are in the code and its commits.

8. Update any further documentation such as `README.md` to reflect any changes in usage or behavior.

---

## CONSTRAINTS

- Run tests after each logical unit of work.
- Do not skip tests — every piece of functionality must be tested.
- Do not deviate from the design without explicit approval. Record every approved deviation under **Decisions** in `.harness/progress.md`.
- Maintain all existing functionality — no breaking changes.
- Follow TDD methodology rigorously.
```

</details>

<details>
<summary><code>.agents/skills/handoff-writing/SKILL.md</code> (already in the branch)</summary>

```markdown
---
name: handoff-writing
description: Write the handoff files that pass work between the phases of the research → design → plan → implement workflow.
---

# Handoff Writing

Every phase runs in a new session and remembers nothing of the previous one. The handoff files are
the only thing the next phase gets, so write them for a reader who has no other context.

## File Location

The specification and the design go to `specs/<slug>/`, where `<slug>` is a short kebab-case
identifier for the feature or change. The tasks go to `backlog/`. The progress of what is being
implemented, a task or a specification, goes to `.harness/progress.md`, and is deleted when it is done.

| Phase     | File                               | Template                                |
| --------- | ---------------------------------- | --------------------------------------- |
| research  | `specs/<slug>/specification.md`    | `templates/specification.md`            |
| design    | `specs/<slug>/design.md`           | `templates/design.md`                   |
| plan      | `backlog/TASK-<n>-<slug>.md`     | the task template in the `plan` skill |
| implement | `.harness/progress.md`             | `templates/progress.md`                 |

The pipeline writes the design after the specification, and the plan cuts the tasks along it.

The templates are in the `templates/` folder next to this file. Copy the template when you create a
handoff, and update the existing file instead of writing a new one.

## General Rules

- Handoff files are Markdown.
- Keep them concise and structured, no unnecessary explanation.
- Don't repeat what an earlier handoff already says, refer to it.
```

</details>

<details>
<summary><code>.agents/skills/handoff-writing/templates/progress.md</code> (already in the branch)</summary>

```markdown
# Progress

## Task
<task id> <task title>, or without a task: the title of specs/<slug>/specification.md

## Done
- <acceptance criterion that is met>: <what you built for it>, covered by <test name>

## Decisions
- <choice you made and why, including every deviation from the design>

## Blockers
- <what is stuck, or "None.">
```

</details>

> [!NOTE]
> Claude Code uses `.claude/skills` rather than `.agents/skills`. The branch has a symlink, `.claude/skills` → `.agents/skills`, so Claude Code uses the same files. There is nothing to rename.
