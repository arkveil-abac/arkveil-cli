import { describe, it, expect, afterEach, vi } from "vitest";
import { showSkill } from "../src/commands/skill/show.js";
import { harness } from "./_harness.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("skill", () => {
  it("fetches the guide and prints its content verbatim", async () => {
    const h = harness(() => ({
      status: 200,
      body: { content: "# Arkveil — working with the access model\n\n1. Inspect before writing.\n" },
    }));
    await showSkill(h.ctx);
    expect(h.calls).toEqual([{ method: "GET", path: "/api/v1/skill" }]);
    expect(h.stdout.join("")).toContain("# Arkveil — working with the access model");
  });
});
