# AI-Augmented Software Engineering

Course material for AI-augmented software engineering at Zühlke.

## Course Homepage

- GitHub Pages: <https://zuehlke.github.io/ai-augmented-software-engineering-course/>

## Run the page locally

To start the app locally, run:

```bash
cd docs
npm install
npm run dev
```

This starts the VitePress dev server on <http://localhost:5174>.

## Configuration

| Variable | Values | Effect |
| --- | --- | --- |
| `VITE_DAY1_LABS_ENABLED` | `true` (default) / `false` | Show Labs 1-6 |
| `VITE_DAY2_LABS_ENABLED` | `true` (default) / `false` | Show Labs 7-13 |
| `VITE_DAY1_PASSWORD` | `promptAndPray` | Password for Labs 1-6 |
| `VITE_DAY2_PASSWORD` | `shipIt` | Password for Labs 7-13 |
| `VITE_AUDIENCE` | `internal` (default) / `github` | Show audience-specific content; `github` clones the lab from GitHub |

Set them as CI/CD variables in GitLab (or in `.gitlab-ci.yml`), in `.github/workflows/pages.yml` for GitHub Pages, or locally in `docs/.env`:

```bash
VITE_DAY2_LABS_ENABLED=false
VITE_AUDIENCE=github
```

Show content for some audiences only (space-separated: `internal`, `github`):

```md
<OnlyOn audience="github">

Only shown on GitHub Pages.

</OnlyOn>
```

## Contributing

Feedback, corrections, and new modules are welcome. 
Open an issue, file a merge request, or contact one of the maintainers. 
Small improvements (typos, clearer wording, updated sources) are just as valuable as larger contributions.

Maintainers:
- [Jonathan Ziller](mailto:jonathan.ziller@zuehlke.com)
- [Marco Romanutti](mailto:marco.romanutti@zuehlke.com)
- [Lukas Grigis](mailto:lukas.grigis@zuhlke.com)

## Usage

This repository contains internal Zühlke training material. Please keep it within the company.
