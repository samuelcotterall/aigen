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
