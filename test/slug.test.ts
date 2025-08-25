import { describe, it, expect } from "vitest";

function makeSlug(s: string) {
  return (
    (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-_.]/g, "") || `agent-${Date.now()}`
  );
}

describe("slug generation", () => {
  it("creates safe slug from name", () => {
    expect(makeSlug("My Agent")).toBe("my-agent");
    expect(makeSlug(" Agent!@# ")).toBe("agent");
  });
});
