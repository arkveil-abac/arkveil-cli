/**
 * Configuration resolution.
 *
 * Precedence (highest wins): CLI flags > environment variables > config file >
 * built-in defaults. The config file is validated at runtime with zod so a
 * malformed file produces a clear error instead of surfacing later as a crash.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { ConfigError } from "./errors.js";

/**
 * Built-in defaults. The spec only declares a local dev server
 * (http://localhost:8087); the production host is used as the default here and
 * can be overridden via --base-url / ARKVEIL_BASE_URL / config file.
 */
export const DEFAULTS = {
  baseUrl: "https://api.arkveil.com",
  /** better-auth is conventionally mounted under /api/auth on the same host. */
  authBasePath: "/api/auth",
  clientId: "arkveil-cli",
  deviceCodePath: "/device/code",
  deviceTokenPath: "/device/token",
  timeoutMs: 30_000,
  retries: 2,
} as const;

/** Environment variable names, documented in the README. */
export const ENV = {
  baseUrl: "ARKVEIL_BASE_URL",
  authBaseUrl: "ARKVEIL_AUTH_BASE_URL",
  clientId: "ARKVEIL_CLIENT_ID",
  scope: "ARKVEIL_SCOPE",
  token: "ARKVEIL_TOKEN",
  workspaceId: "ARKVEIL_WORKSPACE_ID",
  timeout: "ARKVEIL_TIMEOUT",
  retries: "ARKVEIL_RETRIES",
  configDir: "ARKVEIL_CONFIG_DIR",
  noColor: "NO_COLOR",
} as const;

/** Shape of the optional on-disk config file (`<configDir>/config.json`). */
export const configFileSchema = z
  .object({
    baseUrl: z.string().url().optional(),
    authBaseUrl: z.string().url().optional(),
    clientId: z.string().min(1).optional(),
    scope: z.string().optional(),
    workspaceId: z.string().min(1).optional(),
    deviceCodePath: z.string().startsWith("/").optional(),
    deviceTokenPath: z.string().startsWith("/").optional(),
    timeoutMs: z.number().int().positive().optional(),
    retries: z.number().int().min(0).max(10).optional(),
  })
  .strict();

export type ConfigFile = z.infer<typeof configFileSchema>;

/** Global flags parsed by commander on the root program. */
export interface GlobalFlags {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  /** commander sets this to false for `--no-color`. */
  color?: boolean;
  baseUrl?: string;
  apiKey?: string;
  workspace?: string;
  configDir?: string;
  timeout?: string;
}

/** Fully resolved network/auth configuration used by the lib layer. */
export interface ResolvedConfig {
  baseUrl: string;
  authBaseUrl: string;
  clientId: string;
  scope: string | undefined;
  deviceCodePath: string;
  deviceTokenPath: string;
  timeoutMs: number;
  retries: number;
  configDir: string;
  /** Explicit token supplied via --api-key or env, overriding stored creds. */
  explicitToken: string | undefined;
  /**
   * Workspace id sent as `X-Workspace-Id` on every request. Without it the
   * session falls back to the user's oldest workspace server-side, so
   * multi-workspace usage should always set it.
   */
  workspaceId: string | undefined;
}

/** Output/presentation settings derived from flags, env, and TTY detection. */
export interface OutputOptions {
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
  isTty: boolean;
}

export function resolveConfigDir(
  flags: GlobalFlags,
  env: NodeJS.ProcessEnv,
): string {
  if (flags.configDir) return flags.configDir;
  if (env[ENV.configDir]) return env[ENV.configDir] as string;
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim().length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "arkveil");
}

export function credentialsPath(configDir: string): string {
  return join(configDir, "credentials.json");
}

export function configFilePath(configDir: string): string {
  return join(configDir, "config.json");
}

function loadConfigFile(configDir: string): ConfigFile {
  const path = configFilePath(configDir);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new ConfigError(
      `Unable to read config file at ${path}.`,
      "Check file permissions.",
      err,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(
      `Config file at ${path} is not valid JSON.`,
      "Fix or delete the file.",
      err,
    );
  }

  const result = configFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(
      `Config file at ${path} is invalid:\n${issues}`,
      "Correct the listed fields.",
    );
  }
  return result.data;
}

function parsePositiveInt(
  value: string | undefined,
  field: string,
): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new ConfigError(
      `Invalid value for ${field}: "${value}".`,
      "Provide a non-negative integer.",
    );
  }
  return n;
}

/**
 * Resolve final configuration by layering defaults < file < env < flags.
 */
export function resolveConfig(
  flags: GlobalFlags,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedConfig {
  const configDir = resolveConfigDir(flags, env);
  const file = loadConfigFile(configDir);

  const baseUrl =
    flags.baseUrl ?? env[ENV.baseUrl] ?? file.baseUrl ?? DEFAULTS.baseUrl;

  const authBaseUrl =
    env[ENV.authBaseUrl] ?? file.authBaseUrl ?? defaultAuthBaseUrl(baseUrl);

  const timeoutMs =
    parsePositiveInt(flags.timeout, "--timeout") ??
    parsePositiveInt(env[ENV.timeout], ENV.timeout) ??
    file.timeoutMs ??
    DEFAULTS.timeoutMs;

  const retries =
    parsePositiveInt(env[ENV.retries], ENV.retries) ??
    file.retries ??
    DEFAULTS.retries;

  return {
    baseUrl: stripTrailingSlash(baseUrl),
    authBaseUrl: stripTrailingSlash(authBaseUrl),
    clientId: env[ENV.clientId] ?? file.clientId ?? DEFAULTS.clientId,
    scope: env[ENV.scope] ?? file.scope,
    deviceCodePath: file.deviceCodePath ?? DEFAULTS.deviceCodePath,
    deviceTokenPath: file.deviceTokenPath ?? DEFAULTS.deviceTokenPath,
    timeoutMs,
    retries,
    configDir,
    explicitToken: flags.apiKey ?? env[ENV.token],
    workspaceId: flags.workspace ?? env[ENV.workspaceId] ?? file.workspaceId,
  };
}

/** Resolve presentation options. Non-TTY or NO_COLOR forces machine-friendly output. */
export function resolveOutputOptions(
  flags: GlobalFlags,
  env: NodeJS.ProcessEnv = process.env,
  isTty: boolean = process.stdout.isTTY ?? false,
): OutputOptions {
  const noColorEnv = env[ENV.noColor] !== undefined && env[ENV.noColor] !== "";
  const color = flags.color !== false && !noColorEnv && isTty;
  return {
    json: flags.json === true,
    quiet: flags.quiet === true,
    verbose: flags.verbose === true,
    color,
    isTty,
  };
}

export function defaultAuthBaseUrl(baseUrl: string): string {
  return `${stripTrailingSlash(baseUrl)}${DEFAULTS.authBasePath}`;
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
