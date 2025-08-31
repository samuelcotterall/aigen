import { describe, it, expect } from "vitest";
import mergePkg from "../src/merge/packageJson";

describe("mergePackageJsonConservative", () => {
  it("adds missing deps and scripts without overwriting", () => {
    const existing = {
      name: "foo",
      dependencies: { react: "18.0.0" },
      scripts: { test: "vitest" },
    };
    const incoming = {
      dependencies: { react: "19.0.0", lodash: "4.17.21" },
      devDependencies: { vitest: "1.2.3" },
      scripts: { test: "jest", build: "tsc" },
    };
    const res = mergePkg(existing, incoming, { force: false });
    expect(res.merged.dependencies.react).toBe("18.0.0");
    expect(res.merged.dependencies.lodash).toBe("4.17.21");
    expect(res.merged.devDependencies.vitest).toBe("1.2.3");
    expect(res.merged.scripts.test).toBe("vitest");
    expect(res.merged.scripts.build).toBe("tsc");
    expect(res.diff.scripts.added).toContain("build");
  });

  it("overwrites when force=true", () => {
    const existing = { scripts: { test: "vitest" } };
    const incoming = { scripts: { test: "jest" } };
    const res = mergePkg(existing, incoming, { force: true });
    expect(res.merged.scripts.test).toBe("jest");
  });
});
