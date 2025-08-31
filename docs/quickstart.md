# Quickstart — Aigen

This quickstart shows the most common flows: generate an agent instruction pack, export a reproducible preset, and replay it later.

## Run via npx (local development)

Build the CLI and run via a local tarball (during development):

```bash
# build distribution
npm run build

# run the CLI directly (local)
npx ./aigen-0.2.0.tgz create
```

Or after publishing to npm (example):

```bash
npx aigen create
```

## Create an agent (interactive)

```bash
# interactive wizard
npx aigen create
```

Walkthrough:

- The CLI inspects your repository and pre-fills answers when possible.
- You can choose libraries, tools, rules, and provide a seed for deterministic output.
- Preview the generated files, then confirm writing to disk.

## Export a preset for exact replay

```bash
# export resolved config to a file (defaults to aigen.config.json)
npx aigen create --export-config=aigen.config.json --seed=42
```

The generated `aigen.config.json` includes:

- `templateFingerprint` — SHA of the templates used
- `randomSeed` — seed used for deterministic generation
- other inputs (libraries, tools, name, slug)

## Replay a saved preset

```bash
# apply a saved preset non-interactively
npx aigen apply-config aigen.config.json
```

The CLI will validate the `templateFingerprint` to ensure templates haven't changed. If the fingerprint differs, it will warn and abort unless you pass `--ignore-template-drift` or use `--update-config` to refresh the fingerprint.

## Inspect detected metadata

```bash
# print detected metadata for the current directory
npx aigen detect --pretty
```

## Dry run

```bash
# preview files without writing
npx aigen create --dry-run
```

## Safety

- By default, merges create timestamped backups.
- Use `--dry-run` to preview. Use `--yes` to skip prompts in automation.

## Notes

- For local development you can `npm link` or use a local tarball with `npx`.
- Publishing to npm makes the `npx aigen` experience seamless for end users.
