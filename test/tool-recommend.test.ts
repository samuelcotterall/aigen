import { describe, it, expect } from "vitest";
import { loadToolList } from "../src/tool-list.js";

describe("tool recommendation basics", () => {
  it("loads built-in items and provides recommends", async () => {
    const list = await loadToolList();
    const vitest = list.find((l) => l.name === "vitest");
    expect(vitest).toBeDefined();
    expect(vitest?.recommends).toBeDefined();
    expect(vitest?.recommends).toContain("playwright");
  });
});
