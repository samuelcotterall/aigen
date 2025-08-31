---
title: Add unit tests for `detectAgent()`
labels: testing, good first issue
assignees: []
---

Summary

Add a small suite of unit tests for `src/detectAgent.ts` to exercise the common detection scenarios and edge cases. This will make the module robust and prevent regressions when we change detection heuristics.

Why

`detectAgent()` is used to infer existing agent metadata (name, tools, examples, policies) from the filesystem and the current shape is best-effort. We added a few defensive casts and `any` usages during the initial implementation; tests will lock down behavior and document expected outputs.

Acceptance criteria

- Add tests covering at least:

  - `config/agent.json` present and parsed correctly (name, displayName, tools list)
  - `agent.md` only: parse fallback and extract displayName / content
  - `tools.md` present and parsed into `tools` (basic sanity)
  - No-files: returns a defined, empty-ish object rather than throwing
  - Malformed JSON in `config/agent.json` returns a handled error or an empty result (decide behavior and document)

- Tests use the existing Vitest test setup and utilities (mirror style of existing tests under `test/`).
- Tests run as part of `pnpm test` and pass on CI.

Implementation notes / hints

- Use temporary fixture directories under `test/fixtures/detect-agent/*` and cleanup after each test.
- Follow patterns in `test/cli.*.test.ts` and `test/replay.test.ts` for filesystem setup and `out/` usage.
- Prefer black-box assertions (returned object shape) rather than internal implementation details.

Estimated effort: 1–2 hours

Related: `src/detectAgent.ts`, `test/detectAgent.test.ts` (starter tests exist).
