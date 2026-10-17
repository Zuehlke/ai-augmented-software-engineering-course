# AI-Augmented Software Engineering

Course material for AI-augmented software engineering at Zühlke.

## Course Homepage

<https://zuehlke.github.io/ai-augmented-software-engineering/>

## Run the page locally

To start the app locally, run:

```bash
cd docs
npm install
npm run dev
```

This starts the VitePress dev server on <http://localhost:5174>.

## Release content during the course

Toggles (`true`/`false`, default `true`):

- `VITE_DAY1_LABS_ENABLED`: Labs 1-6
- `VITE_DAY2_LABS_ENABLED`: Labs 7-13

A disabled day is hidden from the navigation. An enabled day asks for the password in `VITE_DAY1_PASSWORD` / `VITE_DAY2_PASSWORD`.

Set the toggles and passwords in GitLab as CI/CD variables (or in the `variables` block of `.gitlab-ci.yml`), or locally in `docs/.env` (git-ignored):

```bash
VITE_DAY2_LABS_ENABLED=false
VITE_DAY1_PASSWORD=...
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
