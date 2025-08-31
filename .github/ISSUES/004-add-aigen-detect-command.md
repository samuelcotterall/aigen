---
title: Add `aigen detect` subcommand to print discovered agent metadata
labels: enhancement, cli
assignees: []
---

Summary

Add a small `aigen detect` subcommand that runs `detectAgent()` against the current working directory (or a directory flag) and prints a succinct JSON summary of detected metadata. This helps developers manually inspect what the generator will infer.

Why

Having a lightweight, explicit command for detection aids debugging and transparency. It lets users validate what fields would be prefilled before running the full generator, and can be used in CI diagnostics.

Acceptance criteria

- Add `aigen detect [dir]` CLI command (default to `process.cwd()` or `.` ) that prints a JSON summary to stdout.
- Support `--pretty` to pretty-print JSON.
- Exit code 0 on success; non-zero if detect fails catastrophically.
- Add a small integration test that runs the command in a fixture folder and asserts on stdout content.

Implementation notes

- Reuse `detectAgent()` from `src/detectAgent.ts`.
- Keep the command minimal and synchronous-friendly for CI.

Estimated effort: 1–2 hours

Related: `src/detectAgent.ts`, `src/index.ts`.
