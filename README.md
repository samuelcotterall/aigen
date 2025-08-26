# CLI flags

- --dev: write outputs to a temporary development directory
- --out-dir <path>: explicit output parent directory
- --non-interactive: run without prompts (use flags/defaults)
- --dry-run: preview generated files without writing them
- --merge: merge with existing files (preserve existing files)
- --ast-merge: use AST-based markdown merging (optional remark packages)
- --run-id <id>: deterministic run id
- --seed <seed>: seed to derive deterministic run id
- --force: force overwrite without prompting
- --yes / --confirm-overwrite: assume yes and confirm overwrite (non-interactive)
- --backup-on-overwrite: create timestamped .bak files before overwriting when used with overwrite

# Testing

- Tests mock `@clack/prompts`; use `test/utils/mockPrompts.ts` to create consistent mocks for tests.

# create-agent-instructions (dev notes)

Usage (dev / local):

- Build and run interactively (writes to current working directory):

```bash
npm run build
node dist/index.js
```

- Dev mode: write outputs to a temporary directory (safe for testing):

```bash
node dist/index.js --dev
```

- Load tool list from remote JSON or local file:

```bash
# remote JSON array or objects
node dist/index.js --tools-source https://example.com/tools.json

# local file
node dist/index.js --tools-source ./data/tools.json
```

Notes

- Remote tool lists are cached in OS temp for 24h.
- Accepted recommended tools and custom tools are persisted to user defaults (via `conf`).

CLI flags

- `--dev` — write outputs to a temporary development directory (safe for testing).
- `--out-dir <path>` — explicit output parent directory (overrides cwd).
- `--tools-source <url|file>` — URL or local JSON file path to load tool choices from.
- `--name <displayName>` — skip prompt and use this agent display name.

Overwrite behaviour

- If the computed output directory already exists and is non-empty the CLI will prompt to either overwrite, choose a different parent output directory, or abort. This prevents accidental data loss. In scripts you can avoid the prompt by pre-creating an empty target directory, or by running the CLI with `--out-dir` pointed to an empty location.

Enhanced overwrite options

- `--yes` / `--confirm-overwrite` - treat overwrite-confirm prompts as accepted (useful in CI/automation).
- `--backup-on-overwrite` - when used together with overwrite (interactive Yes or `--force`/`--yes`), create timestamped `.bak` backups of files before overwriting them.

Preview + diffs

- When a target directory exists the CLI now shows which files from the generated templates would be overwritten. For `config/*.json` files it also shows a summarized merged diff based on the configured merge strategy to help you confirm changes safely.

Structured defaults

- Persisted defaults (`conf`) now store structured tool objects (not just names). This preserves metadata such as `hint` and `recommends` so subsequent runs can show richer autocomplete and recommendations.

## Continuous Integration and snapshots

- A dedicated workflow `.github/workflows/render-tests.yml` runs the render script and snapshot assertions.
- `render-tests.yml` runs on pushes and PRs that touch `templates/**` or `schemas/**`, and can be manually dispatched.
- The CI run always executes the render script (`pnpm test:render`) to verify templates render cleanly; snapshot assertions are only executed when template or schema files changed.

Updating snapshots locally

If you intentionally change templates and need to update snapshots locally run:

```bash
pnpm test -- --updateSnapshot
# or using vitest directly
npx vitest --update
```

After updating, commit the modified snapshot files under `test/__snapshots__` so CI can compare them deterministically.
