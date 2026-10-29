# Setup

Choose one setup option and follow the steps.

<ContentTabs :tabs="['Cloud (Codespaces)', 'Local (VS Code)', 'Local (IntelliJ)']">
  <template #tab1>

### 1. Prerequisites

- [GitHub](https://github.com/) account
- Active [GitHub Copilot](https://github.com/features/copilot) or [Claude Code](https://claude.com/de/product/claude-code) license

<OnlyOn platform="gitlab">

> [!IMPORTANT] Don't have a license yet?
> Request one [here](https://ticket.zuehlke.com/support/catalog/items/570).

</OnlyOn>

### 2. Open the course in GitHub Codespaces

Click the badge and confirm **Create codespace** using the default settings:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering)

> [!IMPORTANT]
> GitHub Codespaces free tier includes up to 60 hours per month. 
> Make sure to delete your codespace when you are done to avoid exceeding the free tier limit. You can see all your Codespaces at https://github.com/codespaces.
>
> Note that GitHub may ask for a **payment method purely for verification** to
> unlock Codespaces, even on the free tier.

### 3. Setup AI tool

Choose one of the following:

- **GitHub Copilot (Built-in):** GitHub Copilot is built into GitHub Codespaces. Simply sign in with your GitHub account to use it.
- **Claude Code:** To setup Claude Code, follow the [Claude Code Quickstart guide](https://code.claude.com/docs/en/quickstart). Be aware that Claude Code only provides a command-line interface (CLI) in Codespaces.

### 4. Run the application

Using [task](https://taskfile.dev/) you can run the application from the terminal:

```bash
task run
```

After your application successfully started, you should be able to access the Swagger UI at `.../swagger-ui/index.html` on the forwarded Codespaces URL.

### 5. Agent token {#agent-token}

From Lab 9 on, agents run unattended in [Temporal workflows](/labs/lab-9-durable-workflows), and nobody is there to log in for them. Set up a token once, so every agent run and every new terminal is already logged in.

> [!NOTE]
> You only need this step if you attend the second course day, from Lab 9 on. If you only attend the first day, you can skip it.

**Create a token**

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

[Create a fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with your **personal account** as resource owner (the permission is hidden for organizations) and, under **Account permissions**, set **Copilot Requests** to **Read-only**. Classic tokens (`ghp_…`) don't work with Copilot CLI. The variable name is `COPILOT_GITHUB_TOKEN`.

See [Authenticating GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli) for details.

  </template>
  <template #tab2>

Run this in a terminal (in your Codespace or dev container):

```bash
claude setup-token
```

It asks you to log in through your browser, then prints a token that is valid for one year. It needs a Pro, Max, Team or Enterprise plan. The variable name is `CLAUDE_CODE_OAUTH_TOKEN`.

See [Generate a long-lived token](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token) for details.

  </template>
</ContentTabs>

**Store it**

Store the token as a **Codespaces secret**, so every new Codespace has it, including the one you open for each lab:

1. Open [github.com/settings/codespaces](https://github.com/settings/codespaces) and click **New secret**.
2. Use the variable name from above as **Name**, and paste the token as **Value**.
3. Under **Repository access**, select `Zuehlke/ai-augmented-software-engineering`.

Codespaces only pick up a new secret when they start, so restart a Codespace that is already running.

**Check it**

This prints `set`, never the token itself:

```bash
echo ${CLAUDE_CODE_OAUTH_TOKEN:+set} ${COPILOT_GITHUB_TOKEN:+set}
```

  </template>

  <template #tab2>

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/download) including the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [GitHub Copilot](https://github.com/features/copilot) or [Claude Code](https://claude.com/de/product/claude-code) license active and ready to use in your IDE or CLI

<OnlyOn platform="gitlab">

> [!IMPORTANT] Don't have a license yet?
> Request one [here](https://ticket.zuehlke.com/support/catalog/items/570).

</OnlyOn>

### 2. Clone and open in VS Code

<OnlyOn platform="gitlab">

```bash
git clone https://codehub.zuehlke.com/ai-augmented-software-engineering/lab.git
cd lab
```

</OnlyOn>
<OnlyOn platform="zulu">

```bash
git clone https://gitlab.zuluplane.io/ai-augmented-software-engineering-finstar/labs.git
cd labs
```

</OnlyOn>

Open the project folder in VS Code. 
When being asked, select **Dev Containers: Reopen in Container**. The `.devcontainer/devcontainer.json`
installs Java, Maven, Node.js, and Task inside the container.

### 3. Run the application

Using [task](https://taskfile.dev/) you can run the application:

```bash
task run
```

After your application successfully started, you should be able to access the Swagger UI at [Swagger UI](http://localhost:8080/swagger-ui/index.html).

### 4. Agent token {#agent-token-vscode}

From Lab 9 on, agents run unattended in [Temporal workflows](/labs/lab-9-durable-workflows), and nobody is there to log in for them. Set up a token once, so every agent run and every new terminal is already logged in.

> [!NOTE]
> You only need this step if you attend the second course day, from Lab 9 on. If you only attend the first day, you can skip it.

**Create a token**

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

[Create a fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with your **personal account** as resource owner (the permission is hidden for organizations) and, under **Account permissions**, set **Copilot Requests** to **Read-only**. Classic tokens (`ghp_…`) don't work with Copilot CLI. The variable name is `COPILOT_GITHUB_TOKEN`.

See [Authenticating GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli) for details.

  </template>
  <template #tab2>

Run this in a terminal (in your Codespace or dev container):

```bash
claude setup-token
```

It asks you to log in through your browser, then prints a token that is valid for one year. It needs a Pro, Max, Team or Enterprise plan. The variable name is `CLAUDE_CODE_OAUTH_TOKEN`.

See [Generate a long-lived token](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token) for details.

  </template>
</ContentTabs>

**Store it**

Store the token in `.devcontainer/.env`. Every new terminal in the container loads this file. Uncomment the line for your tool and paste the token:

```bash
COPILOT_GITHUB_TOKEN=github_pat_...
# or
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

Save the file and **open a new terminal**. The file is git-ignored, so the token never ends up in a commit, and it stays in place when `task lab/...` switches branches.

**Check it**

This prints `set`, never the token itself:

```bash
echo ${CLAUDE_CODE_OAUTH_TOKEN:+set} ${COPILOT_GITHUB_TOKEN:+set}
```

  </template>

  <template #tab3>

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [IntelliJ IDEA](https://www.jetbrains.com/idea/download/) including the [Dev Containers plugin](https://www.jetbrains.com/help/idea/connect-to-devcontainer.html)
- [GitHub Copilot](https://github.com/features/copilot) or [Claude Code](https://claude.com/de/product/claude-code) license active and ready to use in your IDE or CLI

<OnlyOn platform="gitlab">

> [!IMPORTANT] Don't have a license yet?
> Request one [here](https://ticket.zuehlke.com/support/catalog/items/570).

</OnlyOn>

### 2. Clone and open in IntelliJ IDEA

<OnlyOn platform="gitlab">

```bash
git clone https://codehub.zuehlke.com/ai-augmented-software-engineering/lab.git
cd lab
```

</OnlyOn>
<OnlyOn platform="zulu">

```bash
git clone https://gitlab.zuluplane.io/ai-augmented-software-engineering-finstar/labs.git
cd labs
```

</OnlyOn>

Open the project folder in IntelliJ IDEA.
When being asked, select **Reopen in Container**. The `.devcontainer/devcontainer.json`
installs Java, Maven, Node.js, and Task inside the container.

> [!IMPORTANT]
> Recent versions of the GitHub Copilot IntelliJ plugin have [known issues](https://github.com/microsoft/copilot-intellij-feedback/issues/1912) related to containerized environments causing unexpected behavior. We recommend using **VS Code** or the **GitHub Copilot CLI** instead.
> If you want to use IntelliJ in a non-containerized environment, you can install Java, Maven, Node.js, and Task manually on your machine and run the application without a container.

### 3. Run the application

Using [task](https://taskfile.dev/) you can run the application:

```bash
task run
```

After your application successfully started, you should be able to access the Swagger UI at [Swagger UI](http://localhost:8080/swagger-ui/index.html).

### 4. Agent token {#agent-token-intellij}

From Lab 9 on, agents run unattended in [Temporal workflows](/labs/lab-9-durable-workflows), and nobody is there to log in for them. Set up a token once, so every agent run and every new terminal is already logged in.

> [!NOTE]
> You only need this step if you attend the second course day, from Lab 9 on. If you only attend the first day, you can skip it.

**Create a token**

<ContentTabs :tabs="['GitHub Copilot CLI', 'Claude Code']">
  <template #tab1>

[Create a fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with your **personal account** as resource owner (the permission is hidden for organizations) and, under **Account permissions**, set **Copilot Requests** to **Read-only**. Classic tokens (`ghp_…`) don't work with Copilot CLI. The variable name is `COPILOT_GITHUB_TOKEN`.

See [Authenticating GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli) for details.

  </template>
  <template #tab2>

Run this in a terminal (in your Codespace or dev container):

```bash
claude setup-token
```

It asks you to log in through your browser, then prints a token that is valid for one year. It needs a Pro, Max, Team or Enterprise plan. The variable name is `CLAUDE_CODE_OAUTH_TOKEN`.

See [Generate a long-lived token](https://code.claude.com/docs/en/authentication#generate-a-long-lived-token) for details.

  </template>
</ContentTabs>

**Store it**

Store the token in `.devcontainer/.env`. Every new terminal in the container loads this file. Uncomment the line for your tool and paste the token:

```bash
COPILOT_GITHUB_TOKEN=github_pat_...
# or
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

Save the file and **open a new terminal**. The file is git-ignored, so the token never ends up in a commit, and it stays in place when `task lab/...` switches branches.

**Check it**

This prints `set`, never the token itself:

```bash
echo ${CLAUDE_CODE_OAUTH_TOKEN:+set} ${COPILOT_GITHUB_TOKEN:+set}
```

  </template>
</ContentTabs>
