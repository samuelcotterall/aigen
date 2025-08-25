// Shared helper to produce a mock implementation for @clack/prompts used in tests.
// Usage in tests:
// import makeClackMock from './utils/mockPrompts';
// vi.mock('@clack/prompts', async () => makeClackMock({ preset: 'openai' }));
export function makeClackMock(responses: Record<string, any> = {}) {
  return {
    intro: responses.intro ?? (() => {}),
    outro: responses.outro ?? (() => {}),
    isCancel: responses.isCancel ?? (() => false),
    select:
      responses.select ??
      (async (opts: any) => {
        if (opts.message?.includes("Choose a preset"))
          return responses.preset ?? "openai";
        if (opts.message?.includes("TypeScript strictness"))
          return responses.tsconfig ?? "strict";
        if (opts.message?.includes("Search for more tools?"))
          return responses.searchMore ?? "no";
        if (
          opts.message?.includes("Target") ||
          opts.message?.includes("exists")
        )
          return responses.target ?? "no";
        return (
          responses.defaultSelect ??
          opts.initialValue ??
          (opts.options && opts.options[0]?.value)
        );
      }),
    multiselect:
      responses.multiselect ??
      (async (opts: any) => responses.multiselectValue ?? []),
    text: responses.text ?? (async () => responses.textValue ?? "done"),
  };
}

export default makeClackMock;
