# Lab 2 · Steering agents using AGENTS.md and skills

## Context

In this exercise, you will configure your project so GitHub Copilot produces more consistent outputs.

Your goal is to reduce ambiguity and improve output quality by changing how Copilot behaves and providing guidance.

## Your Task

Start the lab setup with the following command:

```bash
task lab/steering
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/steering`.
>
> [![Open Lab 2 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fsteering)

After the command is finished, complete the following tasks:

- Describe the role and behavior of agents in `AGENTS.md`
- Add the required frontmatter for Java-specific skills in `.agents/skills/java/SKILLS.md`
- Implement the same endpoint again:
  - `GET /delays?airline_code=AA&limit=50`  
    → returns `200 OK` or `404 Not Found`

> [!NOTE]
> The `TODO` markers in the relevant files will help you get started.

## Solution

<details>
<summary><code>AGENTS.md</code></summary>

```markdown
# Coding Agent Instructions

This repository contains course material centered on a Spring Boot flight API lab.

## Working Style

- Address me as "Dev".
- Prefer the simplest solution that meets the acceptance criteria. Apply YAGNI. Prefer deletion over addition.
- Be direct, concise, and honest. Call out bad ideas plainly.
- Choose boring over clever.
- Prove behavior with executable validation before declaring work done.

## Workflow

- Prefer `task` commands from `Taskfile.yml`. Use `mvn` only for targets Task does not provide or when diagnosing task-level failures.
- Do not execute modifying git commands.
- Read-only git commands for inspection are allowed.
- Avoid using `task` commands that internally are using modifying git commands (e.g., `task lab/*`).
- Do not introduce secrets, tokens, or credentials into the repository.

## Documentation

Use progressive disclosure. Start with the smallest relevant doc set.

- [Project overview](docs/project-overview.md)
```
</details>

<details>
<summary><code>.agents/skills/java/SKILL.md</code></summary>

```markdown
---
name: java
description: Java guidance for Spring Boot work; use when editing Java files, implementing or changing REST endpoints, modifying domain logic or shaping DTO/entity/repository boundaries.
---

Use this skill to keep Java API changes layered, test-first, and contract-safe.

Layered means:
- Controllers stay thin and HTTP-focused.
- Services hold business rules and invariants.
- Repositories stay persistence-focused.

## Paths

### Core Java Changes

Use this path for any edit in src/**/*.java.

Apply these defaults:
- Follow TDD and keep changes small and local.
- For Java test coverage rules and endpoint test requirements, use [SKILL.md](../testing/SKILL.md).
- Prefer small cohesive classes, focused methods, and composition over inheritance.
- Use dependency injection and avoid global mutable state.
- Prefer explicit types unless `var` improves readability without hiding domain meaning.
- Use generics, avoid raw types, and favor immutability where practical.
- Keep comments rare; add them only for intent, tradeoffs, or non-obvious behavior.

When API design or style details are uncertain, read [api-design](../api-design/SKILL.md).

### REST Endpoint Design

Use this path when adding or changing controllers, routes, request/response models, pagination, or status codes.

Execution target:
- Keep controllers thin and delegate to services.
- Use REST resource nouns with plural paths and consistent HTTP verbs.
- Validate request input before business logic.
- Return DTOs, never persistence entities.
- Apply consistent response structures and safe pagination defaults.

For full HTTP semantics and endpoint checklist, read [api-design](../api-design/SKILL.md).

### Error Handling and Contracts

Use this path when introducing exceptions, mapping failures, or revising API error payloads.

Execution target:
- Map domain failures to specific HTTP statuses.
- Use centralized exception handling.
- Keep error payloads consistent and safe.
- Log unexpected failures with context, never secrets.

For allowed status mappings and response safety rules, read [api-design](../api-design/SKILL.md).

## Completion Criterion

The change is done only when every modified Java artifact is accounted for against the layered boundary:
- Controller code contains only HTTP concerns and delegation.
- Service code contains business rules and invariants.
- Repository code contains only persistence concerns.
- API contracts use DTOs with stable field names and safe error semantics.
```
</details>

> [!NOTE]
> Claude Code uses `CLAUDE.md` rather than `AGENTS.md`. Rename `AGENTS.md` to `CLAUDE.md` if you want to use Claude Code.
> If you want one shared source of truth across tools, create a symlink:
>
> ```bash
> # Create a symlink from AGENTS.md to CLAUDE.md
> ln -s AGENTS.md CLAUDE.md
> ```
> 
> Also the skills folder follow a different convention in Claude Code. Rename `.agents/skills` to `.claude/skills` if you want to use Claude Code.
