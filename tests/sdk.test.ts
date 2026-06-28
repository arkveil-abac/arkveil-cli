import { describe, it, expect } from "vitest";
import {
  SDK_CATALOG,
  SDK_TARGET_IDS,
  findTarget,
  renderCatalog,
  renderTarget,
} from "../src/commands/sdk/catalog.js";

describe("SDK catalog", () => {
  it("supports only TypeScript / JavaScript today", () => {
    expect(SDK_CATALOG.language).toBe("TypeScript / JavaScript");
    expect(SDK_CATALOG.languages).toEqual(["TypeScript", "JavaScript"]);
    expect(SDK_CATALOG.registry).toBe("npm");
  });

  it("exposes the three published packages", () => {
    expect(SDK_TARGET_IDS).toEqual(["nest", "node", "core"]);
    const packages = SDK_CATALOG.targets.map((t) => t.package);
    expect(packages).toEqual(["@arkveil/nest", "@arkveil/node", "arkveil"]);
  });

  it("gives every target an install command and a usage snippet", () => {
    for (const t of SDK_CATALOG.targets) {
      expect(t.install).toMatch(/^npm install /);
      expect(t.quickStart.length).toBeGreaterThan(0);
      expect(t.docs).toMatch(/^https:\/\//);
    }
  });

  it("documents the user and context typing registries", () => {
    const interfaces = SDK_CATALOG.typing.registries.map((r) => r.interface);
    expect(interfaces).toContain("ArkveilUserRegistry");
    expect(interfaces).toContain("ArkveilContextRegistry");
    const user = SDK_CATALOG.typing.registries.find(
      (r) => r.interface === "ArkveilUserRegistry",
    );
    expect(user?.source).toContain("arkveil schemas get user");
    expect(SDK_CATALOG.typing.example).toContain('declare module "arkveil"');
  });
});

describe("findTarget", () => {
  it("resolves a known id and rejects an unknown one", () => {
    expect(findTarget("nest")?.package).toBe("@arkveil/nest");
    expect(findTarget("python")).toBeUndefined();
  });
});

describe("renderCatalog", () => {
  it("renders every target and the typing recipe by default", () => {
    const text = renderCatalog();
    expect(text).toContain("@arkveil/nest");
    expect(text).toContain("@arkveil/node");
    expect(text).toContain("arkveil");
    expect(text).toContain("TYPED CODES, USER & CONTEXT ATTRIBUTES");
  });

  it("narrows to a single target when given one", () => {
    const nest = findTarget("nest")!;
    const text = renderCatalog(nest);
    // The shared header note lists all package names, so assert on the unique
    // per-target title blocks instead.
    expect(text).toContain("NestJS SDK");
    expect(text).not.toContain("Node.js / Express SDK");
    expect(text).not.toContain("Core SDK (runtime-agnostic)");
    expect(text).not.toContain("TYPED CODES, USER & CONTEXT ATTRIBUTES");
  });

  it("renderTarget includes platform and install lines", () => {
    const block = renderTarget(findTarget("node")!);
    expect(block).toContain("Platform:");
    expect(block).toContain("Install:");
    expect(block).toContain("npm install @arkveil/node arkveil");
  });
});
