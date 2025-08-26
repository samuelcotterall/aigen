# Testing

This rule concerns testing practices.

Example:

- Prefer unit tests for pure logic and integration tests for external APIs.
- Keep tests fast and deterministic; mock network calls where appropriate.

Do: Write a test covering happy and a few edge cases for new modules.
Don't: Rely on flaky network conditions or large end-to-end tests for small changes.
