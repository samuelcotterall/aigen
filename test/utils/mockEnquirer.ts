// Minimal Enquirer mock for tests that attempt to call Enquirer.prompt.
// By default, return an empty selection. Tests can import and stub this if
// they need specific behavior.
export function makeEnquirerMock(response: any = {}) {
  return {
    prompt: async () => response,
  };
}

export default makeEnquirerMock;
