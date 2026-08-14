# Setup

Choose one setup option and follow the tab.

<ContentTabs :tabs="['Cloud (Codespaces)', 'Local (VS Code)', 'Local (IntelliJ)']">
  <template #tab1>

### 1. Prerequisites

- [GitHub](https://github.com/) account
- Active [GitHub Copilot](https://github.com/features/copilot) or [Claude Code](https://claude.com/de/product/claude-code) license

> [!IMPORTANT] Don't have a license yet?
> Request one [here](https://ticket.zuehlke.com/support/catalog/items/570).

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
- **Claude Code:** To setup Claude Code, follow the [Claude Code Quickstart guide](https://code.claude.com/docs/en/quickstart). Be aware that Claude Code only provides a command-line interface (CLI) in Codespaces, and does not provide an IDE plugin.

### 4. Run the application

Using [task](https://taskfile.dev/) you can run the application from the terminal:

```bash
task run
```

After your application successfully started, you should be able to access the Swagger UI at `.../swagger-ui/index.html` on the forwarded Codespaces URL.

  </template>

  <template #tab2>

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/download) including the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [GitHub Copilot](https://github.com/features/copilot) or [Claude Code](https://claude.com/de/product/claude-code) license active and ready to use in your IDE or CLI

> [!IMPORTANT] Don't have a license yet?
> Request one [here](https://ticket.zuehlke.com/support/catalog/items/570).

### 2. Clone and open in VS Code

```bash
git clone https://github.com/Zuehlke/ai-augmented-software-engineering.git
cd ai-augmented-software-engineering
```

Open the project folder in VS Code. 
When being asked, select **Dev Containers: Reopen in Container**. The `.devcontainer/devcontainer.json`
installs Java, Maven, Node.js, and Task inside the container.

### 3. Run the application

Using [task](https://taskfile.dev/) you can run the application:

```bash
task run
```

After your application successfully started, you should be able to access the Swagger UI at [Swagger UI](http://localhost:8080/swagger-ui/index.html).

  </template>

  <template #tab3>

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [IntelliJ IDEA](https://www.jetbrains.com/idea/download/) including the [Dev Containers plugin](https://www.jetbrains.com/help/idea/connect-to-devcontainer.html)
- [GitHub Copilot](https://github.com/features/copilot) or [Claude Code](https://claude.com/de/product/claude-code) license active and ready to use in your IDE or CLI

> [!IMPORTANT] Don't have a license yet?
> Request one [here](https://ticket.zuehlke.com/support/catalog/items/570).

### 2. Clone and open in IntelliJ IDEA

```bash
git clone https://github.com/Zuehlke/ai-augmented-software-engineering.git
cd ai-augmented-software-engineering
```

Open the project folder in IntelliJ IDEA.
When being asked, select **Reopen in Container**. The `.devcontainer/devcontainer.json`
installs Java, Maven, Node.js, and Task inside the container.

> [!IMPORTANT]
> Recent versions of the GitHub Copilot IntelliJ plugin have [known issues](https://github.com/microsoft/copilot-intellij-feedback/issues/1912) related to containerized enviroments causing unexpected behavior. We recommend using **VS Code** or the **GitHub Copilot CLI** instead.
> If you want to use IntelliJ in a non-containerized enviroment, you can install Java, Maven, Node.js, and Task manually on your machine and run the application without a container.

### 3. Run the application

Using [task](https://taskfile.dev/) you can run the application:

```bash
task run
```

After your application successfully started, you should be able to access the Swagger UI at [Swagger UI](http://localhost:8080/swagger-ui/index.html).

  </template>
</ContentTabs>
