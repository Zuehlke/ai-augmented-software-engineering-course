# Lab 11 · Parallelizing work

## Context

Two agents in one checkout get in each other's way: they edit the same files on the same branch, and one agent's half-finished change breaks the other one's tests.

A **git worktree** is an extra working directory for the same repository, checked out on its own branch. Each agent gets its own worktree, so they can work at the same time without seeing each other's changes. Their results end up on separate branches, which you can review and merge like any other branch.

## Your Task

Start the lab setup with the following command:

```bash
task lab/parallelizing-work
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/parallelizing-work`.
>
> [![Open Lab 11 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fparallelizing-work)

The branch continues where the tracer-bullet backlog left off: TICKET-1 being done makes the next two tickets independent of each other, one Ralph loop per ticket:

<details>
<summary><code>backlog/</code> (already in the branch)</summary>

```markdown
---
id: TICKET-2
status: ready
---

# Airline overview dashboard

Support staff can open the dashboard page, enter an airline code, and see that airline's name plus
how many of its flights are currently active or scheduled, without writing any query themselves.

## Acceptance Criteria

- The dashboard page displays a search box for an airline code.
- Submitting a valid airline code shows the airline's name and a count of its currently active or
  scheduled flights.
- Submitting an airline code that doesn't exist shows a clear "not found" message instead of an
  error page or a blank result.
- The result is produced from a lookup against real airline/flight data, not hand-entered or mocked
  values.
```

```markdown
---
id: TICKET-3
status: ready
---

# Flight status lookup

On the dashboard page, support staff can enter a flight id and see its current status (on time /
delayed / cancelled) and its delay in minutes, without knowing the query API.

## Acceptance Criteria

- The dashboard page displays a search box for a flight id.
- Submitting a valid flight id shows its current status as one of: on time, delayed, or cancelled.
- Submitting a valid flight id that is delayed shows the delay in minutes.
- Submitting a flight id that doesn't exist shows a clear "not found" message instead of an error
  page or a blank result.
- The result reflects the flight's latest delay/status event from real data, not a hand-entered or
  mocked value.
```

</details>

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

In **terminal 1**, start Temporal and the worker, and follow the worker's output. The agent output shows up there:

```bash
task flows:start
flows logs
```

### 1. Run one Ralph loop per ticket

Set `AGENT=copilot` first if you use GitHub Copilot CLI.

In **terminal 2**:

```bash
flows ralph TICKET-2
```

In **terminal 3**:

```bash
flows ralph TICKET-3
```

Both loops run at the same time, in the same worker: `ralph-TICKET-2` and `ralph-TICKET-3`, each on its own ticket, its own branch and with its own `.harness/progress.md`. Their agents' output is mixed in terminal 1, each line prefixed with its workflow. In the web UI at [http://localhost:8233](http://localhost:8233), you see them side by side.

### 2. Find the worktrees

While they work, open a new terminal in your original checkout:

```bash
# Shows your original checkout and one worktree per loop, each with its branch
git worktree list
git status
```

You didn't create these worktrees. Each loop does it itself, with `git worktree add -b agent/ticket-2 .harness/worktrees/ticket-2`: a new branch from your current commit, checked out in a new folder. Both live under `.harness/worktrees/`, which the branch already ignores in `.gitignore`, so the worktrees don't show up as changes in your original checkout. `git status` stays clean, because each loop only changes its own worktree.

The loop in Lab 10 did the same. That's why your checkout stayed as it was until you merged `agent/ticket-1`.

::: code-group

```ts [.harness/flows/src/workflows/ralph.ts (excerpt)]
  // The loop works in a worktree of its own, on the branch agent/<ticket>: its commits, and the reset of a
  // retry, stay out of your checkout. In the pipeline it starts fresh from `base`. On its own (`flows ralph`)
  // it goes on where an earlier run on the same ticket stopped.
  const fresh = base !== undefined;
  const workDir = await addWorktree(repoDir, worktreeName(ticket), branchOf(ticket), base ?? (await headCommit(repoDir)), fresh);
```

:::

> [!NOTE]
> Worktrees only separate files. Ports, databases and caches are still shared. If both agents start the app at once, the second fails with `Port 8080 was already in use`. Give it another port, for example `SERVER_PORT=8081`.

### 3. Look at the results

The branch comes with a dashboard page, still empty, and each ticket adds a lookup to it. Once both loops are done (terminals 2 and 3 are back at the prompt), start the app from the TICKET-2 worktree, in terminal 2:

```bash
cd .harness/worktrees/ticket-2
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. You should see the airline lookup, but not the flight status lookup: that one only exists in the other worktree.

### 4. Clean up

Stop the app (`Ctrl+C`), go back to the repository root (`cd ../../..`) and clean up:

```bash
flows cleanup
```

This stops any workflow still running, runs `git worktree remove` on every worktree under `.harness/worktrees/` and deletes the `agent/*` branches that are merged. `git worktree remove`, rather than deleting the folder, keeps Git from holding on to a stale entry for it. These branches were never merged, so `flows cleanup` keeps them and prints how to look at them or delete them with `git branch -D`. Deleting them discards the agents' work.
