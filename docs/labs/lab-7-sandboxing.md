# Lab 7 · Sandboxing agents

## Context

So far the agent worked directly in your checkout, and you approved every command it ran. A sandbox adds a boundary around the agent: even if it goes wrong or gets compromised, it can't touch your machine, your files, or the network beyond its own API.

In this lab you'll turn on the sandbox, check whether the agent can still reach the internet, block all outbound network access, and check again.

## Your Task

Start the lab setup with the following command:

```bash
task lab/sandboxing
```

> [!IMPORTANT]
> Day 2 needs a dev container built from this branch on: it sets up the sandbox, the agent token and Temporal.
>
> - **Local dev container:** after `task lab/sandboxing`, rebuild the container once (in VS Code: **Dev Containers: Rebuild Container**). You keep it for the rest of day 2.
> - **GitHub Codespaces:** open a **new Codespace** on branch `lab/sandboxing`.
>
> [![Open Lab 7 in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering?ref=lab%2Fsandboxing)

Pick **one** tool, GitHub Copilot CLI or Claude Code, and use it for every step below.

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

### 1. Enable the sandbox

```text
/sandbox enable
```

The sandbox now restricts file writes, but outbound internet access is still **allowed**. You can see the current policy any time with `/sandbox policy`.

### 2. Check what it allows

Run this in the session. The `!` prefix runs it as a shell command, inside the sandbox:

```text
! curl -s -o /dev/null -w "%{http_code}\n" https://example.com
```

It prints `200`: the request went through. A sandbox doesn't block the network unless you configure it to.

### 3. Block the network

Open the sandbox settings:

```text
/sandbox config
```

On the **Network** tab, turn **off** "Allow outbound connections".

> [!NOTE]
> This setting is saved in your user settings, `~/.copilot/settings.json`, not in the repo. Copilot CLI can't store the sandbox's network policy per repo, so the setting applies to every Copilot CLI session on this machine.

### 4. Check again

Run the same `! curl` again in the same session. It now fails right away.

### 5. Turn the network back on

The setting applies to your whole machine. If you leave it off, every Copilot CLI session you start later is affected, also outside this course. Open `/sandbox config` again and, on the **Network** tab, turn "Allow outbound connections" back **on**.

  </template>
  <template #tab2>

### 1. Enable the sandbox

```text
/sandbox
```

On the **Mode** tab, pick **Auto-allow**. This saves the sandbox settings in `.claude/settings.local.json`, your personal settings for this repo. Open the file and check that it looks like this:

```json
{
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "enableWeakerNestedSandbox": true
  }
}
```

- `enabled`: every Bash command runs inside the sandbox.
- `autoAllowBashIfSandboxed`: sandboxed commands run without asking you. The sandbox is the safety boundary instead.
- `enableWeakerNestedSandbox`: lets the sandbox run inside a container, such as a Codespace. The isolation is weaker.

All network traffic now goes through the sandbox's proxy, and no domains are allowed yet. Run `/sandbox` again any time to see the current settings.

### 2. Check what it allows

Run this in the session. The `!` prefix runs it as a shell command, inside the sandbox:

```text
! curl -s -o /dev/null -w "%{http_code}\n" https://example.com
```

`example.com` isn't on the allowlist, so the request needs an approval. Who gives it depends on your permission mode:

- **Default mode:** Claude Code asks you whether to allow `example.com`.
- **Auto mode:** the auto mode classifier decides, without asking you. Often `curl` prints `200` right away, and you don't notice that anything was approved.

If the request is denied, `curl` prints `000`.

Most likely the request gets through one way or the other, and you end up with `200`. So the sandbox doesn't mean "no internet access". It means "no *unapproved* internet access", and the approval doesn't have to come from a human.

### 3. Block the network

To block the network completely, you need the `strictAllowlist` setting. Claude Code ignores it in project settings files such as `.claude/settings.local.json`. It only reads it from your user settings, from managed settings, or from the `--settings` flag. Here you'll use the flag: keep the settings in a file in the repo and pass that file in when you start Claude.

Create `.harness/sandbox/no-network.json`. The `.harness/` folder holds everything that sets up how agents run, separate from the application code:

```json
{
  "sandbox": {
    "enabled": true,
    "enableWeakerNestedSandbox": true,
    "allowUnsandboxedCommands": false,
    "network": {
      "strictAllowlist": true
    }
  }
}
```

Exit the session and start Claude with this file:

```bash
claude --settings "$(cat .harness/sandbox/no-network.json)"
```

- `network.strictAllowlist: true` blocks every host that isn't on the allowlist. Nothing is left to approve, neither by you nor by the auto mode classifier. The file has no `allowedDomains`, so the allowlist is empty and every host is blocked.
- `allowUnsandboxedCommands: false` closes the other way out: running the command outside the sandbox.

### 4. Check again

Run the same `! curl` again. Now it prints `000`, in every permission mode. Nobody is asked for an approval anymore: Claude can't allow `example.com` for one command, and it can't run `curl` outside the sandbox.

  </template>
</ContentTabs>

## Solution

<details>
<summary><code>.harness/sandbox/no-network.json</code></summary>

```json
{
  "sandbox": {
    "enabled": true,
    "enableWeakerNestedSandbox": true,
    "allowUnsandboxedCommands": false,
    "network": {
      "strictAllowlist": true
    }
  }
}
```

</details>
