# Changelog

## Unreleased

- Add `--non-interactive` and `--dry-run` flags to the CLI.
- Add `test/utils/mockPrompts.ts` to centralize `@clack/prompts` test mocks.
- Add `test/utils/mockEnquirer.ts` to help mock Enquirer in tests.
- Add `test/cli.dryrun.test.ts` to assert dry-run behavior.
- Tests updated to use the shared mock helper.
 - Add `--yes` / `--confirm-overwrite` and `--backup-on-overwrite` flags.
 - Improve Enquirer handling: prefer Enquirer only on a real TTY, add safe initial selections, and fallback to `@clack/prompts` when Enquirer fails.
 - Show pre-validation and overwrite previews; JSON `config/*.json` files show a summarized merged diff during confirmation.
