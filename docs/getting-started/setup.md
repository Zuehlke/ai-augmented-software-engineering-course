# Setup

Choose one setup option and follow the tab.

<ContentTabs :tabs="['Cloud (Codespaces)', 'Local (VS Code)', 'Local (IntelliJ)']">
  <template #tab1>

### 1. Open the course in GitHub Codespaces

Click the badge and confirm **Create codespace** using the default settings:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Zuehlke/ai-augmented-software-engineering)

> [!IMPORTANT]
> GitHub Codespaces free tier includes up to 60 hours per month. 
> Make sure to delete your codespace when you are done to avoid exceeding the free tier limit.
> 
> Note that GitHub may ask for a **payment method purely for verification** to
> unlock Codespaces, even on the free tier.

### 2. Run the project

```bash
task verify-tools
task run
task test
```

To confirm the application is running, open `.../swagger-ui/index.html` on the forwarded Codespaces URL.

  </template>

  <template #tab2>

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another local Docker-compatible runtime)
- [VS Code](https://code.visualstudio.com/download) including the [VS Code Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### 2. Clone and open in VS Code

```bash
git clone https://github.com/Zuehlke/ai-augmented-software-engineering.git
cd ai-augmented-software-engineering
```

Use **Dev Containers: Reopen in Container** in VS Code. The `.devcontainer/devcontainer.json`
installs Java, Maven, Node.js, and Task inside the container and also applies the recommended VS Code extensions.

### 3. Run the project

```bash
task verify-tools
task run
task test
```

To confirm the application is running, open [Swagger UI](http://localhost:8080/swagger-ui/index.html).

  </template>

  <template #tab3>

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another local Docker-compatible runtime)
- [IntelliJ IDEA](https://www.jetbrains.com/idea/download/) including the [IntelliJ Dev Containers plugin](https://www.jetbrains.com/help/idea/connect-to-devcontainer.html)

### 2. Clone and open in IntelliJ IDEA

```bash
git clone https://github.com/Zuehlke/ai-augmented-software-engineering.git
cd ai-augmented-software-engineering
```

Open the project folder in IntelliJ IDEA and start it with the Dev Containers workflow, using the repository's `.devcontainer/devcontainer.json`.
This provides Java, Maven, Node.js, and Task inside the container.

### 3. Run the project

```bash
task verify-tools
task run
task test
```

To confirm the application is running, open [Swagger UI](http://localhost:8080/swagger-ui/index.html).

  </template>
</ContentTabs>
