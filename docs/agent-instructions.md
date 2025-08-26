# Project AI Assistant Instructions

The assistant should follow these high-level project conventions when generating code, docs, and scripts.

Note: Do not re-enforce rules already covered by linters or formatters (ESLint, Prettier, flake8, etc.). Focus on higher-level organization, naming, file sizes, scripts, docs, and repository conventions.

## Project Structure

- Primary source directory (e.g. 'src')

  - Do: use `src` for Primary source directory (e.g. 'src') when applicable.
  - Don't: use inconsistent or ambiguous values for Primary source directory (e.g. 'src').

- Top-level test directory (e.g. 'test' or 'tests')

  - Do: use `test` for Top-level test directory (e.g. 'test' or 'tests') when applicable.
  - Don't: use inconsistent or ambiguous values for Top-level test directory (e.g. 'test' or 'tests').

- Prefer co-locating tests next to implementation files

  - Do: set Prefer co-locating tests next to implementation files to true when appropriate.
  - Don't: set Prefer co-locating tests next to implementation files to false without a clear reason.

- Static assets directory (optional)
  - Do: follow this guideline when designing code or docs.
  - Don't: ignore this guidance without recording a rationale.

## File Conventions

- Preferred casing for file names

  - Do: prefer `kebab-case` for Preferred casing for file names (one of: kebab-case, camelCase, snake_case, PascalCase).
  - Don't: use values outside the approved set for Preferred casing for file names.

- Suffix for component files (e.g. .component.tsx)

  - Do: follow this guideline when designing code or docs.
  - Don't: ignore this guidance without recording a rationale.

- Glob pattern for test files (e.g. \*_/_.test.\*)

  - Do: use `**/*.test.*` for Glob pattern for test files (e.g. \*_/_.test.\*) when applicable.
  - Don't: use inconsistent or ambiguous values for Glob pattern for test files (e.g. \*_/_.test.\*).

- Prefer co-locating small assets (CSS/images) with components
  - Do: set Prefer co-locating small assets (CSS/images) with components to true when appropriate.
  - Don't: set Prefer co-locating small assets (CSS/images) with components to false without a clear reason.

## File Limits

- Recommended maximum lines per file

  - Do: keep Recommended maximum lines per file at 300 or lower (guideline).
  - Don't: exceed 300 for Recommended maximum lines per file without refactoring or justification.

- maxFunctionsPerFile

  - Do: keep maxFunctionsPerFile at 12 or lower (guideline).
  - Don't: exceed 12 for maxFunctionsPerFile without refactoring or justification.

- Guideline for function complexity
  - Do: follow this guideline when designing code or docs.
  - Don't: ignore this guidance without recording a rationale.

## Naming Conventions

- Recommended prefix for package.json scripts (e.g., 'dev:', 'build:')

  - Do: use `ci:` for Recommended prefix for package.json scripts (e.g., 'dev:', 'build:') when applicable.
  - Don't: use inconsistent or ambiguous values for Recommended prefix for package.json scripts (e.g., 'dev:', 'build:').

- Preferred executable names for CLI tools

  - Do: prefer aigen for Preferred executable names for CLI tools.
  - Don't: rely on unapproved or unrelated tools for Preferred executable names for CLI tools.

- Regex or pattern for package name (optional)
  - Do: follow this guideline when designing code or docs.
  - Don't: ignore this guidance without recording a rationale.

## Documentation

- Require README.md at project root

  - Do: set Require README.md at project root to true when appropriate.
  - Don't: set Require README.md at project root to false without a clear reason.

- Preferred docs folder e.g. 'docs' or 'website'

  - Do: use `docs` for Preferred docs folder e.g. 'docs' or 'website' when applicable.
  - Don't: use inconsistent or ambiguous values for Preferred docs folder e.g. 'docs' or 'website'.

- Preferred inline doc style (e.g., 'JSDoc', 'TSDoc', 'Sphinx')
  - Do: use `TSDoc` for Preferred inline doc style (e.g., 'JSDoc', 'TSDoc', 'Sphinx') when applicable.
  - Don't: use inconsistent or ambiguous values for Preferred inline doc style (e.g., 'JSDoc', 'TSDoc', 'Sphinx').

## Scripts

- Scripts that should exist in package.json (e.g., build,test,lint)

  - Do: prefer build, test, lint for Scripts that should exist in package.json (e.g., build,test,lint).
  - Don't: rely on unapproved or unrelated tools for Scripts that should exist in package.json (e.g., build,test,lint).

- Script names that should be avoided
  - Do: prefer deploy:prod for Script names that should be avoided.
  - Don't: rely on unapproved or unrelated tools for Script names that should be avoided.

## Testing Conventions

- Preferred test frameworks or runners

  - Do: prefer vitest for Preferred test frameworks or runners.
  - Don't: rely on unapproved or unrelated tools for Preferred test frameworks or runners.

- Target percentage for test coverage (informational)
  - Do: keep Target percentage for test coverage (informational) at 80 or lower (guideline).
  - Don't: exceed 80 for Target percentage for test coverage (informational) without refactoring or justification.

## Repository

- Name of the default branch (e.g., 'main')

  - Do: use `main` for Name of the default branch (e.g., 'main') when applicable.
  - Don't: use inconsistent or ambiguous values for Name of the default branch (e.g., 'main').

- Recommend using a PR template

  - Do: set Recommend using a PR template to true when appropriate.
  - Don't: set Recommend using a PR template to false without a clear reason.

- Preferred branch naming pattern (e.g., feature/\*)
  - Do: use `(feature|fix|chore)/.*` for Preferred branch naming pattern (e.g., feature/\*) when applicable.
  - Don't: use inconsistent or ambiguous values for Preferred branch naming pattern (e.g., feature/\*).

## Preferred Tools

- Preferred libraries, CLIs, or infrastructure choices (informational).
  - Do: prefer vitest, tsx, tsup for Preferred libraries, CLIs, or infrastructure choices (informational)..
  - Don't: rely on unapproved or unrelated tools for Preferred libraries, CLIs, or infrastructure choices (informational)..

## Disallowed Practices

- High-level practices to avoid (e.g., 'global variables', 'deeply nested callbacks').
  - Do: prefer global variables, deeply nested callbacks for High-level practices to avoid (e.g., 'global variables', 'deeply nested callbacks')..
  - Don't: rely on unapproved or unrelated tools for High-level practices to avoid (e.g., 'global variables', 'deeply nested callbacks')..

## How to use these rules

- Prefer creating modular, well-documented files following the repository `docs` and `README.md` conventions.

- When unsure, follow the `examples` section in the schema or ask for clarification.

- Avoid changing code style that is already enforced by linters or automated formatting.

---

Generated from `schemas/eslint-style.schema.json`.
