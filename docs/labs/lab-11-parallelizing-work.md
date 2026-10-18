# Lab 11 · Parallelizing work

## Context

Two agents in one checkout get in each other's way: they edit the same files on the same branch, and one agent's half-finished change breaks the other one's tests.

A git worktree is an extra working directory for the same repository, checked out on its own branch. Each agent gets its own worktree, so they can work at the same time without seeing each other's changes. Their results end up on separate branches, which you can review and merge like any other branch.

## Your Task

Start the lab setup with the following command:

```bash
task lab/parallelizing-work
```

> [!IMPORTANT]
> If you work in **GitHub Codespaces**, open a **new Codespace** on branch `lab/parallelizing-work`.
>
> [![Open Lab 11 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fparallelizing-work)

> [!NOTE]
> The agents in this lab run unattended, so they need the [agent token from the setup](/getting-started/setup#agent-token).

Start Temporal and the worker, and open `flows watch`. Press `a` there to switch to GitHub Copilot CLI if you use it.

```bash
task flows:start
task flows:watch
```

### 1. Run one Ralph loop per ticket

The branch continues where the tracer-bullet backlog left off: with TICKET-1 done, TICKET-2 and TICKET-3 are independent of each other, so they can run at the same time.

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

On the dashboard page, support staff can enter a flight number and see its current status (on time /
delayed / cancelled) and its delay in minutes, without knowing the query API.

## Acceptance Criteria

- The dashboard page displays a search box for a flight number.
- Submitting a valid flight number shows its current status as one of: on time, delayed, or cancelled.
- Submitting a valid flight number that is delayed shows the delay in minutes.
- Submitting a flight number that doesn't exist shows a clear "not found" message instead of an error
  page or a blank result.
- The result reflects the flight's latest delay/status event from real data, not a hand-entered or
  mocked value.
```

</details>

Press `Tab` for the board. Select TICKET-2 in **Ready**, press `s`, then `y`. Do the same for TICKET-3.

<FlowsWatch scene="lab11-start" />

Both loops now run at the same time, each on its own ticket and branch, with its own `.harness/progress.md`. On the board, both cards move to **Running**. `Tab` back to the pipeline view: the worker output mixes both agents, each line prefixed with its loop.

<details>
<summary>How the harness creates a worktree for each loop</summary>

Each loop starts by creating its worktree, `.harness/worktrees/ticket-2` on the branch `agent/ticket-2`:

```ts
// .harness/src/workflows/ralph.ts
const workDir = await addWorktree(repoDir, worktreeName(ticket), branchOf(ticket), base ?? (await headCommit(repoDir)), fresh);
```

`addWorktree` runs `git worktree add`. If the branch already exists, for example after a single run, it checks it out again instead of starting over.

Every agent run of the loop then works in `workDir`, so it only sees its own worktree.

</details>

### 2. Find the worktrees

While they work, in a new terminal:

```bash
git worktree list
git status
```

You see your checkout and one worktree per loop, each on its own branch. The loops created them, and `.gitignore` ignores `.harness/worktrees/`, so `git status` stays clean.

> [!NOTE]
> Worktrees only separate files. Ports, databases and caches are still shared. If both agents start the app at once, the second fails with `Port 8080 was already in use`. Give it another port, for example `SERVER_PORT=8081`.

### 3. Look at the results

When both cards wait under **Needs you** as *ready to merge*, start the app from the TICKET-2 worktree, in the same terminal:

```bash
cd .harness/worktrees/ticket-2
task run
```

Open the dashboard at [http://localhost:8080/dashboard.html](http://localhost:8080/dashboard.html). In **GitHub Codespaces**, open the **Ports** tab, click the globe icon next to port `8080` (**Flight API**) and append `/dashboard.html` to the URL. You see the airline lookup, but not the flight status lookup: that one only exists in the other worktree.

### 4. Clean up

Stop the app (`Ctrl+C`) and go back to the repository root (`cd ../../..`). To remove a loop's worktree and branch, open its ticket on the board with `Enter`, press `x`, then `y`. Do this for TICKET-2 and TICKET-3.

<FlowsWatch scene="lab11-cleanup" />
