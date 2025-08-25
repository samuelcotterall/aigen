# Requirements

This document outlines the requirements for the **create-agent-instructions** CLI tool.

## Core Functionality

- Run via `npx create-agent-instructions`.
- Provide an interactive CLI that guides developers through creating AI agent instructions.
- Allow selection of:
  - Preferred libraries (OpenAI, LangChain, LlamaIndex, AutoGen, MCP).
  - Project structure (single-package, monorepo).
  - Coding conventions (TypeScript strictness, naming, documentation style).
  - Testing frameworks (Vitest, none).
  - Linting/formatting tools (Biome, ESLint, none).
- Generate outputs including:
  - `agent.md` (system prompt with conventions).
  - `tools.md` (tool definitions).
  - `policies.md` (safety and privacy guardrails).
  - `config/agent.json` (machine-readable manifest).
  - Example starter code for selected libraries.

## Templates

- Store all templates in `templates/` directory.
- Support `.eta` templating engine with optional JSON front matter for conditions (e.g. library-specific).
- Outputs should be cleanly formatted (Markdown, JSON, TypeScript).

## User Preferences

- Save defaults to user config (`~/.config/agent-cli/config.json`).
- On subsequent runs, use defaults to speed up interaction.

## Extensibility

- Allow new templates for different runtimes and presets.
- Plugin system for community-driven presets (e.g., `create-agent-instructions-plugin-*`).
- Ability to extend tool library definitions easily.

## Development

- Written in TypeScript.
- Bundled with `tsup`.
- Tested with `vitest`.
- Use `tsx` for dev runs.
- Lint/format with Biome or ESLint + Prettier.

## Future Enhancements

- Add CI-friendly mode (`--ci`) to regenerate configs.
- Add prompt linting to check for contradictions or missing tool docs.
- Support exporting to multiple instruction formats (OpenAI, Anthropic, Azure, Vertex).
