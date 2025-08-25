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

Structured defaults

- Persisted defaults (`conf`) now store structured tool objects (not just names). This preserves metadata such as `hint` and `recommends` so subsequent runs can show richer autocomplete and recommendations.
