import { describe, it, expect } from "vitest";
import {
  compareSemver,
  detectPackageManager,
  installCommand,
  readPackageMeta,
} from "../src/commands/update/npm.js";

describe("compareSemver", () => {
  it("orders core versions numerically, not lexically", () => {
    expect(compareSemver("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareSemver("1.1.0", "1.1.0")).toBe(0);
  });

  it("tolerates a leading v and short versions", () => {
    expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
    expect(compareSemver("1.2", "1.2.0")).toBe(0);
  });

  it("ranks a prerelease below the matching release", () => {
    expect(compareSemver("1.2.0-beta", "1.2.0")).toBeLessThan(0);
    expect(compareSemver("1.2.0", "1.2.0-beta")).toBeGreaterThan(0);
    expect(compareSemver("1.2.0-alpha", "1.2.0-beta")).toBeLessThan(0);
  });
});

describe("detectPackageManager", () => {
  it("recognizes package managers from the install path", () => {
    expect(detectPackageManager("/home/u/.local/share/pnpm/global/5/node_modules/@arkveil/cli/dist/index.js", {})).toBe("pnpm");
    expect(detectPackageManager("/home/u/.yarn/global/node_modules/@arkveil/cli/dist/index.js", {})).toBe("yarn");
    expect(detectPackageManager("/home/u/.bun/install/global/node_modules/@arkveil/cli/dist/index.js", {})).toBe("bun");
    expect(detectPackageManager("/usr/local/lib/node_modules/@arkveil/cli/dist/index.js", {})).toBe("npm");
  });

  it("falls back to the npm_config_user_agent env var", () => {
    expect(
      detectPackageManager("/opt/cli/dist/index.js", { npm_config_user_agent: "pnpm/8.0.0 node/v20" }),
    ).toBe("pnpm");
  });

  it("defaults to npm when nothing matches", () => {
    expect(detectPackageManager("/opt/cli/dist/index.js", {})).toBe("npm");
  });
});

describe("installCommand", () => {
  it("builds the right global-install command per package manager", () => {
    expect(installCommand("npm", "@arkveil/cli@latest")).toEqual({
      cmd: "npm",
      args: ["install", "-g", "@arkveil/cli@latest"],
    });
    expect(installCommand("pnpm", "@arkveil/cli@latest")).toEqual({
      cmd: "pnpm",
      args: ["add", "-g", "@arkveil/cli@latest"],
    });
    expect(installCommand("yarn", "@arkveil/cli@next")).toEqual({
      cmd: "yarn",
      args: ["global", "add", "@arkveil/cli@next"],
    });
    expect(installCommand("bun", "@arkveil/cli@latest")).toEqual({
      cmd: "bun",
      args: ["add", "-g", "@arkveil/cli@latest"],
    });
  });
});

describe("readPackageMeta", () => {
  it("reads this CLI's name and version", () => {
    const meta = readPackageMeta();
    expect(meta.name).toBe("@arkveil/cli");
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
