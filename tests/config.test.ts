import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveConfig,
  resolveOutputOptions,
  resolveConfigDir,
  DEFAULTS,
} from "../src/lib/config.js";
import { ConfigError } from "../src/lib/errors.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "arkveil-cfg-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("resolveConfig precedence", () => {
  it("uses built-in defaults when nothing else is set", () => {
    const config = resolveConfig({ configDir: dir }, {});
    expect(config.baseUrl).toBe(DEFAULTS.baseUrl);
    expect(config.authBaseUrl).toBe(`${DEFAULTS.baseUrl}${DEFAULTS.authBasePath}`);
    expect(config.clientId).toBe(DEFAULTS.clientId);
    expect(config.timeoutMs).toBe(DEFAULTS.timeoutMs);
    expect(config.retries).toBe(DEFAULTS.retries);
    expect(config.explicitToken).toBeUndefined();
  });

  it("reads values from the config file", () => {
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({ baseUrl: "https://file.example.com", timeoutMs: 1234, clientId: "from-file" }),
    );
    const config = resolveConfig({ configDir: dir }, {});
    expect(config.baseUrl).toBe("https://file.example.com");
    expect(config.timeoutMs).toBe(1234);
    expect(config.clientId).toBe("from-file");
  });

  it("lets env override the config file", () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify({ baseUrl: "https://file.example.com" }));
    const config = resolveConfig({ configDir: dir }, { ARKVEIL_BASE_URL: "https://env.example.com" });
    expect(config.baseUrl).toBe("https://env.example.com");
  });

  it("lets flags override env and file", () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify({ baseUrl: "https://file.example.com" }));
    const config = resolveConfig(
      { configDir: dir, baseUrl: "https://flag.example.com", timeout: "9000" },
      { ARKVEIL_BASE_URL: "https://env.example.com", ARKVEIL_TIMEOUT: "5000" },
    );
    expect(config.baseUrl).toBe("https://flag.example.com");
    expect(config.timeoutMs).toBe(9000);
  });

  it("resolves the token from --api-key over env", () => {
    const config = resolveConfig({ configDir: dir, apiKey: "flag-token" }, { ARKVEIL_TOKEN: "env-token" });
    expect(config.explicitToken).toBe("flag-token");
  });

  it("falls back to ARKVEIL_TOKEN when no flag is given", () => {
    const config = resolveConfig({ configDir: dir }, { ARKVEIL_TOKEN: "env-token" });
    expect(config.explicitToken).toBe("env-token");
  });

  it("strips trailing slashes from base URLs", () => {
    const config = resolveConfig({ configDir: dir, baseUrl: "https://x.example.com/" }, {});
    expect(config.baseUrl).toBe("https://x.example.com");
  });

  it("throws ConfigError for malformed JSON", () => {
    writeFileSync(join(dir, "config.json"), "{ not json");
    expect(() => resolveConfig({ configDir: dir }, {})).toThrow(ConfigError);
  });

  it("throws ConfigError for an invalid timeout value", () => {
    expect(() => resolveConfig({ configDir: dir, timeout: "-5" }, {})).toThrow(ConfigError);
  });
});

describe("resolveConfigDir", () => {
  it("prefers the flag", () => {
    expect(resolveConfigDir({ configDir: "/explicit" }, {})).toBe("/explicit");
  });
  it("then the env var", () => {
    expect(resolveConfigDir({}, { ARKVEIL_CONFIG_DIR: "/from-env" })).toBe("/from-env");
  });
  it("then XDG_CONFIG_HOME", () => {
    expect(resolveConfigDir({}, { XDG_CONFIG_HOME: "/xdg" })).toBe("/xdg/arkveil");
  });
});

describe("resolveOutputOptions", () => {
  it("disables color when NO_COLOR is set", () => {
    const opts = resolveOutputOptions({}, { NO_COLOR: "1" }, true);
    expect(opts.color).toBe(false);
  });
  it("disables color for --no-color", () => {
    const opts = resolveOutputOptions({ color: false }, {}, true);
    expect(opts.color).toBe(false);
  });
  it("disables color when not a TTY", () => {
    const opts = resolveOutputOptions({}, {}, false);
    expect(opts.color).toBe(false);
  });
  it("enables color on a TTY with no overrides", () => {
    const opts = resolveOutputOptions({}, {}, true);
    expect(opts.color).toBe(true);
  });
  it("reflects --json and --quiet", () => {
    const opts = resolveOutputOptions({ json: true, quiet: true }, {}, true);
    expect(opts.json).toBe(true);
    expect(opts.quiet).toBe(true);
  });
});
