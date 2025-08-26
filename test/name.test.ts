import { resolveName, makeSlug } from "../src/name";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, it, expect } from "vitest";

async function withTempDir(fn: (d: string) => Promise<void>) {
  const os = await import("node:os");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aigen-test-"));
  try {
    await fn(tmp);
  } finally {
    // best-effort cleanup
    try {
      await fs.rm(tmp, { recursive: true, force: true });
    } catch {}
  }
}

describe("resolveName", () => {
  it("prefers opts.name", async () => {
    await withTempDir(async (d) => {
      const res = await resolveName({ name: "OptName" }, {}, d);
      expect(res.name).toBe("OptName");
      expect(res.slug).toBe("optname");
    });
  });

  it("falls back to defaults.name", async () => {
    await withTempDir(async (d) => {
      const res = await resolveName({}, { name: "DefaultName" }, d);
      expect(res.name).toBe("DefaultName");
    });
  });

  it("reads package.json name when present", async () => {
    await withTempDir(async (d) => {
      await fs.writeFile(
        path.join(d, "package.json"),
        JSON.stringify({ name: "pkg-name" })
      );
      const res = await resolveName({}, {}, d);
      expect(res.name).toBe("pkg-name");
    });
  });

  it("reads README title when present", async () => {
    await withTempDir(async (d) => {
      await fs.writeFile(
        path.join(d, "README.md"),
        "# My README Title\nSome text\n"
      );
      const res = await resolveName({}, {}, d);
      expect(res.name).toBe("My README Title");
    });
  });

  it("falls back to folder name", async () => {
    await withTempDir(async (d) => {
      // d is something like /tmp/aigen-test-xxxx; basename should be non-empty
      const res = await resolveName({}, {}, d);
      expect(res.name).toBeTruthy();
    });
  });

  it("makeSlug produces safe slugs", () => {
    expect(makeSlug("My Agent! v1")).toBe("my-agent-v1");
    expect(makeSlug("    Spaces   ")).toBe("spaces");
  });
});
