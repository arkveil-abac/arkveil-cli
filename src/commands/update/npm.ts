/**
 * Pure helpers for `arkveil update`: read this install's package metadata,
 * compare semver, detect which package manager installed the CLI, build the
 * right global-install command, and query the npm registry for the latest
 * published version. Kept free of I/O side effects (beyond the registry fetch)
 * so they are straightforward to unit-test.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, parse } from "node:path";
import { NetworkError } from "../../lib/errors.js";

/** Identity of the running CLI, read from the bundled package.json. */
export interface PackageMeta {
  name: string;
  version: string;
}

/** Read the name + version of this install by walking up to the nearest
 * package.json. Works both bundled (dist/index.js → repo root) and unbundled
 * (src/commands/update/npm.ts during dev/test). */
export function readPackageMeta(): PackageMeta {
  let dir = dirname(fileURLToPath(import.meta.url));
  const { root } = parse(dir);
  while (true) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      return { name: pkg.name ?? "@arkveil/cli", version: pkg.version ?? "0.0.0" };
    }
    if (dir === root) break;
    dir = dirname(dir);
  }
  return { name: "@arkveil/cli", version: "0.0.0" };
}

/** Split a semver string into numeric core parts and a prerelease tag. */
function parseSemver(version: string): { core: number[]; pre: string | null } {
  const cleaned = version.trim().replace(/^v/, "");
  const [main = "", pre = null] = cleaned.split("-", 2) as [string, string?];
  const core = main.split(".").map((p) => Number.parseInt(p, 10) || 0);
  while (core.length < 3) core.push(0);
  return { core: core.slice(0, 3), pre: pre ?? null };
}

/**
 * Compare two semver strings. Returns a negative number if `a < b`, zero if
 * equal, positive if `a > b`. A version with a prerelease tag (1.2.0-beta) ranks
 * below the same core release (1.2.0); prerelease tags compare lexically.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa.core[i] ?? 0) - (pb.core[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1; // release > prerelease
  if (pb.pre === null) return -1;
  return pa.pre < pb.pre ? -1 : 1;
}

/** Package managers we know how to drive for a global install. */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const PACKAGE_MANAGERS: PackageManager[] = ["pnpm", "yarn", "bun", "npm"];

/**
 * Best-effort guess at which package manager owns this global install. Inspects
 * the module path first (global store layouts are distinctive) and falls back to
 * the npm_config_user_agent env var, then defaults to npm.
 */
export function detectPackageManager(
  modulePath: string,
  env: NodeJS.ProcessEnv = process.env,
): PackageManager {
  const path = modulePath.toLowerCase();
  if (path.includes("pnpm")) return "pnpm";
  if (path.includes(`${"/"}.bun${"/"}`) || path.includes("/bun/")) return "bun";
  if (path.includes(".yarn") || path.includes("/yarn/")) return "yarn";

  const agent = (env.npm_config_user_agent ?? "").toLowerCase();
  const fromAgent = PACKAGE_MANAGERS.find((pm) => agent.startsWith(pm));
  if (fromAgent) return fromAgent;

  return "npm";
}

/** Build the global-install command for a package manager and a package spec. */
export function installCommand(
  pm: PackageManager,
  spec: string,
): { cmd: string; args: string[] } {
  switch (pm) {
    case "pnpm":
      return { cmd: "pnpm", args: ["add", "-g", spec] };
    case "yarn":
      return { cmd: "yarn", args: ["global", "add", spec] };
    case "bun":
      return { cmd: "bun", args: ["add", "-g", spec] };
    case "npm":
    default:
      return { cmd: "npm", args: ["install", "-g", spec] };
  }
}

/**
 * Resolve the published version for a dist-tag (default "latest") from the npm
 * registry. Uses the lightweight per-tag manifest endpoint rather than the full
 * packument.
 */
export async function fetchLatestVersion(opts: {
  name: string;
  tag?: string;
  registry?: string;
  timeoutMs?: number;
}): Promise<string> {
  const tag = opts.tag ?? "latest";
  const registry = (opts.registry ?? "https://registry.npmjs.org").replace(/\/+$/, "");
  // Scoped names must keep the slash percent-encoded in the path.
  const encoded = opts.name.replace("/", "%2f");
  const url = `${registry}/${encoded}/${tag}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new NetworkError(
        `npm registry returned ${res.status} for ${opts.name}@${tag}.`,
        "Check your network connection and that the package/tag exists.",
      );
    }
    const body = (await res.json()) as { version?: string };
    if (!body.version) {
      throw new NetworkError(
        `npm registry response for ${opts.name}@${tag} had no version.`,
      );
    }
    return body.version;
  } catch (err) {
    if (err instanceof NetworkError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new NetworkError(
        `Timed out contacting the npm registry for ${opts.name}@${tag}.`,
        "Retry, or increase the timeout with --timeout <ms>.",
        err,
      );
    }
    throw new NetworkError(
      `Could not reach the npm registry: ${err instanceof Error ? err.message : String(err)}`,
      "Check your network connection.",
      err,
    );
  } finally {
    clearTimeout(timer);
  }
}
