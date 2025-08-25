import { describe, it, expect } from "vitest";
import { mergeMarkdownSections } from "../src/write";

describe("markdown section merge helper", () => {
  it("appends a new heading section when missing", async () => {
    const existing = `# Title\n\n## A\nContent A`;
    const incoming = `## B\nContent B`;
    const out = await mergeMarkdownSections(existing, incoming);
    expect(out).toContain("## A");
    expect(out).toContain("## B");
  });

  it("merges content under an existing header without duplicating identical nodes", async () => {
    const existing = `# Title\n\n## A\nItem 1\n\nItem 2`;
    const incoming = `## A\nItem 2\n\nItem 3`;
    const out = await mergeMarkdownSections(existing, incoming);
    // should contain Item3 and only one Item2
    const countItem2 = (out.match(/Item 2/g) || []).length;
    expect(countItem2).toBe(1);
    expect(out).toContain("Item 3");
  });

  it("handles intro-only existing docs (no headings)", async () => {
    const existing = `This is an intro paragraph only.`;
    const incoming = `## New Section\nNew content`;
    const out = await mergeMarkdownSections(existing, incoming);
    expect(out).toContain("This is an intro paragraph only.");
    expect(out).toContain("## New Section");
  });

  it("respects different heading levels when merging", async () => {
    const existing = `# Title\n\n### Sub\nOld`;
    const incoming = `### Sub\nNew\n\n## Sibling\nX`;
    const out = await mergeMarkdownSections(existing, incoming);
    expect(out).toContain("### Sub");
    expect(out).toContain("New");
    expect(out).toContain("## Sibling");
  });

  it("merges nested subsections without colliding headings", async () => {
    const existing = `# Root\n\n## A\nContent A\n\n### A.1\nSubcontent`;
    const incoming = `## A\nAdditional\n\n### A.2\nNew Sub`;
    const out = await mergeMarkdownSections(existing, incoming);
    expect(out).toContain("### A.1");
    expect(out).toContain("### A.2");
    expect(out).toContain("Additional");
  });
});
