# Lab 6 · Automated feedback loops

## Context

As we know, usage of skills and instructions is not deterministic.

For verification harnesses we want deterministic checks via hooks, not only probabilistic behavior.

## Your Task

Start the lab setup with the following command:

```bash
task lab hook
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/hook`.
>
> [![Open Lab 6 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fhook)

After the command is finished, complete the following tasks:

- Update the hook in `verification-harness.json` to make sure tests are run whenever the agent stops.
- Open a new chat and verify that tests are being executed.

## Tips & Tricks

- The `TODO` markers in the relevant files will help you get started.
- You can find a reference solution in branch `solution/hook`.
