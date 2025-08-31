---
title: Tighten TypeScript types for `detectAgent` and remove `any` casts
labels: refactor, typescript
assignees: []
---

Summary

`src/detectAgent.ts` currently returns a loosely-typed object and a few `any` casts are used when merging detected results into the CLI's imported defaults. Tighten the types into an exported interface and refactor call sites to avoid `any`.

Why

Strong typing will improve maintainability and catch real issues at compile time. It will also make it easier to add features like the `aigen detect` command and to write precise tests.

Acceptance criteria

- Define exported `DetectResult` interface in `src/detectAgent.ts` capturing fields we actually populate (name, displayName, slug, tools[], examples[], policies[] or policyPaths[]).
- Update `src/index.ts` and other callsites to import the type and handle merging without `any` casts.
- Add unit tests asserting the exported types (via test-time TS checks) or otherwise validate behavior.

Implementation notes

- Keep the API compatible: keep returning the same data but with explicit typing.
- Consider using `zod` if you want runtime validation; otherwise runtime guards in the module are fine.

Estimated effort: 1–2 hours

Related: `src/detectAgent.ts`, `src/index.ts`.
