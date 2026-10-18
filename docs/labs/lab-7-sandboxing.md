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

On the **Mode** tab, pick **Auto-allow**. This saves the sandbox settings in `.claude/settings.local.json`, your personal settings for this repo.

All network traffic now goes through the sandbox's proxy, and no domains are allowed yet. Run `/sandbox` again any time to see the current settings.

### 2. Check what it allows

Run this in the session. The `!` prefix runs it as a shell command, inside the sandbox:

```text
! curl -s -o /dev/null -w "%{http_code}\n" https://example.com
```

`example.com` isn't on the allowlist, so it needs an approval: from you in default mode, from the classifier in auto mode. You most likely get `200` (allowed) rather than `000` (blocked).

So the sandbox doesn't block the internet. It only blocks *unapproved* access.

### 3. Block the network

To block the network completely, you need `strictAllowlist`. Claude Code ignores it in project settings. Instead, you can pass it as part of your sandbox config with the `--settings` flag.

Create `.harness/sandbox/no-network.json` (`.harness/` holds the agent setup, separate from the app code):

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

- `enabled`: turns the sandbox on.
- `enableWeakerNestedSandbox`: lets the sandbox run inside a container, such as a Codespace, with weaker isolation.
- `allowUnsandboxedCommands: false`: Claude can't retry a blocked command outside the sandbox.
- `strictAllowlist`: hosts that aren't on the allowlist are blocked instead of asking you. This file allows none, so everything is blocked.

Exit the session and start Claude with this file:

```bash
claude --settings "$(cat .harness/sandbox/no-network.json)"
```

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
