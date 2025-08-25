ESLint Style Schema

This folder contains a JSON Schema `eslint-style.schema.json` which models high-level project style preferences and provides suggested mappings to ESLint rule configurations.

Usage

- Validate a project's style configuration against `eslint-style.schema.json`.
- Use `eslintRuleMapping` as a starting point to generate `.eslintrc.js` or `.eslintrc.json` entries.

Mapping

The `formatting`, `bestPractices`, `react`, and `typescript` sections represent human-friendly preferences. The `eslintRuleMapping` object contains recommended rule arrays that can be copied into an ESLint config. For TypeScript-specific naming conventions use the `@typescript-eslint/naming-convention` rule and populate it based on the `naming` section.

Example: generate an ESLint rule for quotes from the schema value:

- If `formatting.quotes` is `single` -> use `["quotes","single",{ "avoidEscape": true }]`

Notes

- This schema is intentionally conservative; it focuses on mapping human preferences to ESLint rules rather than being a full-blown ESLint config generator.
- You can extend `eslintRuleMapping.additionalProperties` to add finer-grained rules.
