# Copilot Rails — Guardrails feature review

This document captures a concise review of the `guardrails` proposal from
`SPECIFICATION.md`. It lists strengths, gaps/risks, and a prioritized set of
next steps to implement a safe MVP.

## Summary (one-liner)

The spec targets a real pain (agents stomping on terminals/ports) and is
well-scoped; start with a non-destructive dry-run MVP, add safe `--force`
behaviour with backups, and address platform/monorepo edge cases next.

## Strengths

- Clear safety-first approach (no overwrites without `--force`).
- Uses VS Code problem matchers and dedicated terminals to prevent terminal
  explosion and task overlap — a good technical fit.
- Practical port persistence strategy (`.port.<role>.json`) for agents and
  E2E flows.
- Complete flag surface (`--dry-run`, `--no-install`, `--force`, `--scope`).

## Gaps, clarifications & risks

1. package.json merge algorithm needs exact rules and conflict UX (diff +
   prompt, or append-only unless `--force`).
2. Overwriting `.vscode/tasks.json` is risky; prefer writing
   `tasks.copilot-rails.json` and requiring explicit `--force` to replace.
3. Windows / PowerShell shell quirks: provide OS-aware templates or a Node
   wrapper to avoid quoting/env differences.
4. Monorepo detection & scope: ensure writes target the intended package and
   respect workspaces.
5. Problem matcher patterns are brittle across framework versions — allow
   per-framework overrides and make them configurable.
6. Port-acquisition race conditions: persist atomically and re-check.

## Prioritized implementation plan

### MVP (non-destructive)

- Implement `--dry-run` that prints exact planned writes and install commands.
- Detect PM and framework; render templates for Next/Vite/CRA/Node and
  `scripts/ensure-port.mjs`/`.cjs` shims.
- Merge `package.json` scripts conservatively:
  - add missing scripts;
  - if script exists and differs, show diff and refuse to overwrite unless
    `--force`.
- Write `.vscode/tasks.copilot-rails.json` by default, only write
  `.vscode/tasks.json` when `--force`.
- Append `.port.*.json` to `.gitignore`.

### Polishing

- Implement `--force` overwrites with timestamped `.bak` backups and restore
  semantics.
- Implement `--with-launch` to generate `launch.json` with `preLaunchTask`.
- Add OS-aware templates or a Node wrapper script to avoid shell portability
  issues.

### Future

- Interactive diff/merge UI for `package.json` and `tasks.json`.
- CI smoke tests that run tasks and assert background matchers behave.

## Minimal contract

- Inputs: cwd (or `--scope`), flags (`--dry-run`, `--no-install`, `--force`,
  `--pm`, `--with-launch`).
- Outputs: files written (scripts, vscode tasks, `.gitignore`), optional
  `package.json` updates, and devDependencies installed.
- Exit codes: 0 success, 1 missing `package.json`, 2 write error, 3 install
  error.

## Tests / acceptance (high level)

- Run `--dry-run` to verify planned changes; run without `--no-install` to
  verify install command.
- Assert idempotency by running twice and confirming no duplicate changes.
- Confirm `dev:all` task uses dedicated terminals and problem matchers to
  sequence API → web and report readiness.

## Next action suggestions

- I can scaffold the MVP `--dry-run` flow (render templates, print diffs);
  or implement the conservative `package.json` merge logic and conflict
  preview — which would you prefer me to implement next?
