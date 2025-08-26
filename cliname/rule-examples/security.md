# Security

This rule concerns security-sensitive guidance.

Example:

- Validate and sanitize all external inputs.
- Never commit secrets; prefer environment variables and secret stores.

Do: Use parameterized queries and safe parsing libraries.
Don't: Log sensitive credentials or embed API keys in source.
