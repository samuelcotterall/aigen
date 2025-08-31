---
title: Add `--update-config` / interactive fingerprint refresh when applying presets
labels: enhancement, cli
assignees: []
---

Summary

When a user applies a saved preset whose `templateFingerprint` no longer matches the current templates, offer an interactive option (or `--update-config`) to refresh the fingerprint and re-save the preset, or to proceed anyway. This improves UX for intentional template updates while preserving safety on accidental drift.

Why

Currently applying a preset aborts when fingerprint drift is detected unless `--ignore-template-drift` is passed. We should provide a better workflow: prompt the user with a diff summary and an option to update the saved preset's fingerprint, proceed anyway, or cancel.

Acceptance criteria

- CLI adds `--update-config` (or similar) flag to `aigen apply-config` behavior.
- In interactive runs, when drift is detected, show a prompt with options: "Update preset fingerprint and continue", "Proceed anyway (ignore drift)", "Cancel".
- When user chooses update, write updated fingerprint to the manifest file (preserve other fields) and emit a message.
- When `--update-config` used non-interactively, update without prompting.
- Add unit/integration tests that simulate drift and assert the correct prompt and file update behavior.

Implementation notes

- Reuse `computeTemplatesFingerprint()` and `savePreset()` in `src/cli/config.ts`.
- Keep the existing `--ignore-template-drift` flag for backwards compatibility.

Estimated effort: 2–4 hours

Related: `src/cli/config.ts`, `src/index.ts` (apply/export/save logic).
