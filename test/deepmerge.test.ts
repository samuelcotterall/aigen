import { describe, it, expect } from "vitest";
import { deepMerge as _deepMerge } from "../src/write";

describe("deepMerge utility", () => {
  it("merges nested objects preferring existing values", () => {
    const a = { a: 1, nested: { x: 1, y: 2 } };
    const b = { b: 2, nested: { y: 3, z: 4 } };
    const res = (_deepMerge as any)(a, b);
    expect(res.a).toBe(1);
    expect(res.b).toBe(2);
    expect(res.nested.x).toBe(1);
    expect(res.nested.y).toBe(2); // prefer existing a.nested.y
    expect(res.nested.z).toBe(4);
  });

  it("merges arrays of objects by name and merges their fields", () => {
    const a = [
      { name: "toolA", description: "A", input: { a: 1 } },
      { name: "toolB", description: "B", input: { a: 1 } },
    ];
    const b = [
      { name: "toolB", description: "B-new", input: { b: 2 } },
      { name: "toolC", description: "C" },
    ];
    const res = (_deepMerge as any)(a, b);
    // result should contain merged toolB with description from a preserved
    const byName = Object.fromEntries(res.map((r: any) => [r.name, r]));
    expect(byName.toolA).toBeDefined();
    expect(byName.toolB).toBeDefined();
    expect(byName.toolB.description).toBe("B");
    expect(byName.toolB.input).toEqual({ a: 1, b: 2 });
    expect(byName.toolC).toBeDefined();
  });
});
