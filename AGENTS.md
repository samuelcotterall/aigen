<!-- AGENTS.md generated from repository metadata. Edit as needed. -->

# AGENTS.md

## Project overview

This repository (`aigen`) scaffolds opinionated agent projects and templates. It provides a CLI (`bin/aigen`) and templates under `templates/` and `src/templates.ts` used to render generated projects.

## Machine metadata (parser-friendly)

```json
{
  "setupCommands": ["pnpm install"],
  "devCommands": ["pnpm dev"],
  "buildCommands": ["pnpm build"],
  "typecheckCommands": ["pnpm exec tsc --noEmit"],
  "testCommands": ["pnpm test"],
  "safeToAutoRun": ["pnpm exec tsc --noEmit", "pnpm test"],
  "templatesPath": "templates/",
  "generatorEntry": "src/templates.ts"
}
```

## Setup commands

- Install deps: `pnpm install`
- Start dev server: `pnpm dev`

## Build & test

- Build: `pnpm build`
- Typecheck: `pnpm exec tsc --noEmit`
- Run tests: `pnpm test`

When making changes, run the typechecker and tests locally before opening a PR.

## Where templates live

Templates and generator code are under `templates/` and `src/templates.ts`. The CLI uses these to render generated agent projects.

## How agents should run checks

- Agents should prefer the nearest `AGENTS.md` to the file they modify.
- Only auto-run commands listed under `safeToAutoRun` above. Treat deploy or destructive commands as requiring manual review.

## Security notes / DO NOT AUTO-RUN

Do not automatically execute deploy or environment-modifying commands. Examples:

- any script that writes to a production environment
- commands that require elevated credentials or secrets

## PR guidance

- PR title format: `[<package>] <Title>` when relevant.
- Run `pnpm lint` and `pnpm test` before committing.

## Contact

If in doubt, ask maintainers listed in `README.md` before running any risky commands.
