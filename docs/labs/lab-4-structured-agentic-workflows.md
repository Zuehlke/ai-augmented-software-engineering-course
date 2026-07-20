# Lab 4 · Structured agentic workflows

## Context

You already created your research step.

Now apply the full workflow with these phases:

- research
- plan
- implement

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

- Write the missing frontmatter for the skills.
- Implement the same endpoint again using the research → plan → implement workflow:
  - `GET /delays?airline_code=AA&limit=50`

> [!NOTE]
> The `TODO` markers in the relevant files will help you get started.

## Solution

<details>
<summary><code>.agents/skills/plan/SKILL.md</code></summary>

```markdown
---
name: plan
description: Create a detailed implementation plan from requirements, specifying architecture, tests, and integration steps.
disable-model-invocation: true
---

## TASK

You are creating a detailed plan and design for the implementation of a requirement.

The plan must be detailed enough to allow a human or less capable coding agent to implement it, but it should be as concise as possible to avoid overload.

Do not repeat the requirements — the implementing agent will read the refine handoff for context.

Focus on architectural building blocks:
- which modules to change
- which functions or endpoints to create or modify
- which tests must be written
- how components integrate

Do not include unnecessary code-level implementation details.

DO NOT refer to anything as “optional” or “not needed”. Clearly specify exactly which changes must be made, but do not write literal code.

You MUST NOT make any code changes or offer to make any code changes as part of this task. This is purely to create a plan document.

---

## ARCHITECTURAL REQUIREMENTS

- Must follow the repository coding guidelines.
- Must follow TDD methodology (tests before implementation).
- Must maintain 80% test coverage for new code.
- Must follow existing code patterns and conventions.
- Must handle all edge cases identified in requirements.

---

## STEPS

1. Read and understand the latest refined specification for the feature:
    - Use the most recent research handoff in `specs/`<slug>`/specification.md` where `<slug>` is a short kebab-case identifier for the feature or change.

2. Read and analyze the codebase to understand how the requirements can be implemented.
    - Do not rely solely on project overview knowledge.

3. If there are uncertainties:
    - Ask the user at most the **5 highest-impact clarifying questions** using the #askQuestions tool.
    - Only ask questions that block correct implementation or carry high risk.
    - Skip trivial questions.
    - If uncertainty is non-critical, make and document a sensible assumption.

4. Apply the **handoff-writing skill** to create the **plan-phase handoff** containing the implementation plan.

5. Output a short summary to the chat (not the file):
    - assumptions made
    - clarifications received

6. Ask the user for feedback and integrate the feedback into the plan document in a follow-up pass.

7. Do **not start implementation**. The implement agent is responsible for that phase.
```

</details>

<details>
<summary><code>.agents/skills/implement/SKILL.md</code></summary>

```markdown
---
name: implement
description: Implement the plan using TDD, ensuring all tests and quality checks pass, and document the result.
disable-model-invocation: true
---

## TASK

You are implementing a plan. You must follow the instructions from the plan document and work until all specified changes are implemented.

Your work is only done when:
- All acceptance criteria are met
- All tests (new and existing) pass successfully
- There are no quality check errors
- The code is properly formatted

---

## STEPS

1. Read the specification to understand acceptance criteria from a user perspective.
  - Use the latest specification in `specs/<slug>/specification.md` where `<slug>` is a short kebab-case identifier for the feature or change.

2. Read the latest design in `specs/<slug>/design.md` to understand the implementation details.

3. Implement the changes using TDD (tests before implementation).

4. Iterate until all acceptance criteria are met and all test cases succeed.
  - YOU MUST NOT STOP until all quality checks succeed.

5. Update any further documentation such as `README.md` to reflect any changes in usage or behavior.

6. Apply the **handoff-writing skill** to persist the **implement-phase handoff** documenting:
  - what changed
  - files changed
  - tests added/modified
  - how to run/verify
  - docs/changelog updates
  - deviations from plan
  - validation results (tests / quality checks / acceptance criteria)
---

## CONSTRAINTS

- Run tests after each logical unit of work.
- Do not skip tests — every piece of functionality must be tested.
- Do not deviate from the plan without explicit approval.
- Maintain all existing functionality — no breaking changes.
- Follow TDD methodology rigorously.
```

</details>
