/**
 * Authentication: the OAuth 2.0 Device Authorization Grant (RFC 8628), as
 * exposed by better-auth's Device Authorization plugin, plus a secure local
 * credential store.
 *
 * NOTE: the bundled OpenAPI spec declares no auth endpoints, so the device-code
 * and token URLs are derived from configuration (`authBaseUrl` + paths) rather
 * than from the spec. They default to better-auth conventions and are fully
 * overridable via config/env. See README → Authentication.
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { z } from "zod";
import { credentialsPath } from "./config.js";
import type { ResolvedConfig } from "./config.js";
import type { Output } from "./output.js";
import { createInstrumentedFetch } from "./http.js";
import { AuthError, CliError, ExitCode } from "./errors.js";

const KEYCHAIN_SERVICE = "arkveil-cli";

/** Minimal slice of keytar we depend on (loaded dynamically, optional). */
interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

/** A token set as returned by the token endpoint. */
export interface TokenSet {
  accessToken: string;
  tokenType: string;
  refreshToken: string | undefined;
  scope: string | undefined;
  /** Seconds until expiry, if the server provided it. */
  expiresInSec: number | undefined;
}

/** Device authorization response (RFC 8628 §3.2), normalized to camelCase. */
export interface DeviceCodeInfo {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string | undefined;
  expiresInSec: number;
  intervalSec: number;
}

/** What we persist locally. Secrets live in the keychain when available. */
export interface StoredCredentials {
  storage: "file" | "keychain";
  accessToken: string;
  tokenType: string;
  refreshToken?: string;
  scope?: string;
  obtainedAt: string;
  expiresAt?: string;
  baseUrl: string;
  authBaseUrl: string;
  clientId: string;
}

const storedSchema = z.object({
  storage: z.enum(["file", "keychain"]),
  accessToken: z.string().optional(),
  tokenType: z.string(),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
  obtainedAt: z.string(),
  expiresAt: z.string().optional(),
  baseUrl: z.string(),
  authBaseUrl: z.string(),
  clientId: z.string(),
});

const deviceCodeSchema = z
  .object({
    device_code: z.string(),
    user_code: z.string(),
    verification_uri: z.string().optional(),
    verification_url: z.string().optional(),
    verification_uri_complete: z.string().optional(),
    expires_in: z.number(),
    interval: z.number().optional(),
  })
  .passthrough();

const tokenSchema = z
  .object({
    access_token: z.string(),
    token_type: z.string().optional(),
    expires_in: z.number().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
  })
  .passthrough();

const tokenErrorSchema = z
  .object({
    error: z.string(),
    error_description: z.string().optional(),
  })
  .passthrough();

let keytarCache: KeytarLike | null | undefined;

async function loadKeytar(out: Output): Promise<KeytarLike | null> {
  if (keytarCache !== undefined) return keytarCache;
  try {
    const mod = (await import("keytar")) as unknown as {
      default?: KeytarLike;
    } & KeytarLike;
    keytarCache = (mod.default ?? mod) as KeytarLike;
    out.verbose("keytar available — using OS keychain for credential storage");
  } catch (err) {
    keytarCache = null;
    out.verbose(
      `keytar unavailable (${err instanceof Error ? err.message : String(err)}) — using file storage`,
    );
  }
  return keytarCache;
}

/** Reset the keytar probe cache. Test-only seam. */
export function __resetKeytarCache(): void {
  keytarCache = undefined;
}

function keychainAccount(config: ResolvedConfig): string {
  return `${config.clientId}@${config.baseUrl}`;
}

// ---------------------------------------------------------------------------
// Device authorization flow
// ---------------------------------------------------------------------------

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

/** Step 1: request a device + user code from the authorization server. */
export async function requestDeviceCode(
  config: ResolvedConfig,
  out: Output,
): Promise<DeviceCodeInfo> {
  const fetchImpl = createInstrumentedFetch({
    timeoutMs: config.timeoutMs,
    retries: 0,
    out,
  });
  const url = `${config.authBaseUrl}${config.deviceCodePath}`;
  // better-auth's device plugin requires a JSON body (snake_case fields).
  const payload: Record<string, string> = { client_id: config.clientId };
  if (config.scope) payload.scope = config.scope;

  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await safeText(response);
    throw new AuthError(
      `Device authorization request failed (${response.status} at ${url}).${detail ? ` ${detail}` : ""}`,
      "Verify ARKVEIL_AUTH_BASE_URL / client id point at the better-auth device endpoint.",
    );
  }

  const json = await parseJson(response, url);
  const parsed = deviceCodeSchema.safeParse(json);
  if (!parsed.success) {
    throw new AuthError(
      `Device authorization response from ${url} was not in the expected shape.`,
      "Confirm the endpoint implements the RFC 8628 device authorization grant.",
    );
  }

  const data = parsed.data;
  const verificationUri = data.verification_uri ?? data.verification_url;
  if (!verificationUri) {
    throw new AuthError(
      `Device authorization response from ${url} is missing a verification URL.`,
    );
  }

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri,
    verificationUriComplete: data.verification_uri_complete,
    expiresInSec: data.expires_in,
    intervalSec: data.interval ?? 5,
  };
}

export interface PollHooks {
  /** Called once per poll tick so the UI can keep a spinner alive. */
  onTick?: (secondsRemaining: number) => void;
}

/** Step 2: poll the token endpoint until the user approves, denies, or it expires. */
export async function pollForToken(
  config: ResolvedConfig,
  info: DeviceCodeInfo,
  out: Output,
  hooks: PollHooks = {},
): Promise<TokenSet> {
  const fetchImpl = createInstrumentedFetch({
    timeoutMs: config.timeoutMs,
    retries: 0,
    out,
  });
  const url = `${config.authBaseUrl}${config.deviceTokenPath}`;
  const deadline = Date.now() + info.expiresInSec * 1000;
  let intervalMs = info.intervalSec * 1000;

  for (;;) {
    if (Date.now() >= deadline) {
      throw new AuthError(
        "The device code expired before authorization completed.",
        "Run `arkveil auth login` again and approve the request more quickly.",
      );
    }

    hooks.onTick?.(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    await sleep(intervalMs);

    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: DEVICE_CODE_GRANT,
        device_code: info.deviceCode,
        client_id: config.clientId,
      }),
    });

    const json = await parseJson(response, url);

    // Treat any payload carrying an access_token as success — better-auth may
    // return 200 here regardless of the polling state.
    const tokenParsed = tokenSchema.safeParse(json);
    if (response.ok && tokenParsed.success) {
      return {
        accessToken: tokenParsed.data.access_token,
        tokenType: tokenParsed.data.token_type ?? "Bearer",
        refreshToken: tokenParsed.data.refresh_token,
        scope: tokenParsed.data.scope,
        expiresInSec: tokenParsed.data.expires_in,
      };
    }

    const errorCode = extractOAuthError(json) ?? `http_${response.status}`;

    switch (errorCode) {
      case "authorization_pending":
        out.verbose("authorization pending; continuing to poll");
        break;
      case "slow_down":
        intervalMs += 5_000;
        out.verbose(`server asked to slow down; interval now ${intervalMs}ms`);
        break;
      case "expired_token":
        throw new AuthError(
          "The device code expired before authorization completed.",
          "Run `arkveil auth login` again.",
        );
      case "access_denied":
        throw new AuthError(
          "Authorization was denied.",
          "If this was a mistake, run `arkveil auth login` and approve the request.",
        );
      default: {
        const description = extractOAuthErrorDescription(json);
        throw new AuthError(
          `Authorization failed: ${errorCode}${description ? ` — ${description}` : ""}.`,
        );
      }
    }
  }
}

/** Best-effort: open the verification URL in the user's default browser. */
export async function openBrowser(url: string, out: Output): Promise<boolean> {
  try {
    const mod = (await import("open")) as unknown as {
      default: (target: string) => Promise<unknown>;
    };
    await mod.default(url);
    return true;
  } catch (err) {
    out.verbose(
      `could not open browser automatically: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Credential store
// ---------------------------------------------------------------------------

export async function saveToken(
  config: ResolvedConfig,
  token: TokenSet,
  out: Output,
): Promise<StoredCredentials> {
  const keytar = await loadKeytar(out);
  const obtainedAt = new Date().toISOString();
  const expiresAt =
    token.expiresInSec !== undefined
      ? new Date(Date.now() + token.expiresInSec * 1000).toISOString()
      : undefined;

  const meta: StoredCredentials = {
    storage: keytar ? "keychain" : "file",
    accessToken: token.accessToken,
    tokenType: token.tokenType,
    refreshToken: token.refreshToken,
    scope: token.scope,
    obtainedAt,
    expiresAt,
    baseUrl: config.baseUrl,
    authBaseUrl: config.authBaseUrl,
    clientId: config.clientId,
  };

  if (keytar) {
    await keytar.setPassword(
      KEYCHAIN_SERVICE,
      keychainAccount(config),
      JSON.stringify({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      }),
    );
    writeCredentialFile(config, {
      ...meta,
      accessToken: "",
      refreshToken: undefined,
    });
  } else {
    writeCredentialFile(config, meta);
  }

  return meta;
}

function writeCredentialFile(
  config: ResolvedConfig,
  meta: StoredCredentials,
): void {
  const path = credentialsPath(config.configDir);
  // For keychain storage the file omits the secret entirely.
  const payload =
    meta.storage === "keychain"
      ? { ...meta, accessToken: undefined, refreshToken: undefined }
      : meta;
  mkdirSync(config.configDir, { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(payload, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
}

/** Load stored credentials, resolving the secret from the keychain if needed. */
export async function loadStoredCredentials(
  config: ResolvedConfig,
  out: Output,
): Promise<StoredCredentials | null> {
  const path = credentialsPath(config.configDir);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    out.verbose(
      `unable to read credentials: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    out.warn(
      `Credentials file at ${path} is corrupt; ignoring. Run \`arkveil auth login\` to re-authenticate.`,
    );
    return null;
  }

  const parsed = storedSchema.safeParse(json);
  if (!parsed.success) {
    out.warn(`Credentials file at ${path} is invalid; ignoring.`);
    return null;
  }

  const meta = parsed.data;
  if (meta.storage === "keychain") {
    const keytar = await loadKeytar(out);
    if (!keytar) {
      out.warn(
        "Credentials are stored in the OS keychain but keytar is unavailable.",
      );
      return null;
    }
    const secret = await keytar.getPassword(
      KEYCHAIN_SERVICE,
      keychainAccount(config),
    );
    if (!secret) return null;
    const parsedSecret = JSON.parse(secret) as {
      accessToken: string;
      refreshToken?: string;
    };
    return {
      ...meta,
      accessToken: parsedSecret.accessToken,
      refreshToken: parsedSecret.refreshToken,
    };
  }

  if (!meta.accessToken) return null;
  return { ...meta, accessToken: meta.accessToken };
}

/** Remove stored credentials from both the file and the keychain. */
export async function clearStoredCredentials(
  config: ResolvedConfig,
  out: Output,
): Promise<boolean> {
  let removed = false;
  const path = credentialsPath(config.configDir);
  try {
    rmSync(path, { force: false });
    removed = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      out.verbose(
        `could not remove ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const keytar = await loadKeytar(out);
  if (keytar) {
    try {
      const deleted = await keytar.deletePassword(
        KEYCHAIN_SERVICE,
        keychainAccount(config),
      );
      removed = removed || deleted;
    } catch (err) {
      out.verbose(
        `could not clear keychain entry: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return removed;
}

/**
 * Resolve the bearer token to use for API calls: an explicit token from
 * --api-key/env wins; otherwise fall back to stored credentials.
 */
export async function resolveToken(
  config: ResolvedConfig,
  out: Output,
): Promise<string | undefined> {
  if (config.explicitToken) return config.explicitToken;
  const stored = await loadStoredCredentials(config, out);
  return stored?.accessToken;
}

/** Throw a friendly AuthError if no token is configured. */
export async function requireToken(
  config: ResolvedConfig,
  out: Output,
): Promise<string> {
  const token = await resolveToken(config, out);
  if (!token) {
    throw new AuthError("You are not authenticated.");
  }
  return token;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Extract the OAuth error code from a token-endpoint payload, handling both the
 * RFC 8628 top-level shape (`{ error: "authorization_pending" }`) and
 * better-auth's nested envelope (`{ error: { error: "..." } }`).
 */
function extractOAuthError(json: unknown): string | undefined {
  const top = tokenErrorSchema.safeParse(json);
  if (top.success) return top.data.error;
  if (json && typeof json === "object") {
    const nested = (json as Record<string, unknown>).error;
    if (nested && typeof nested === "object") {
      const code =
        (nested as Record<string, unknown>).error ?? (nested as Record<string, unknown>).code;
      if (typeof code === "string") return code;
    }
  }
  return undefined;
}

/** Pull a human-readable error description from either error envelope shape. */
function extractOAuthErrorDescription(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  const obj = json as Record<string, unknown>;
  if (typeof obj.error_description === "string") return obj.error_description;
  if (typeof obj.message === "string") return obj.message;
  const nested = obj.error;
  if (nested && typeof nested === "object") {
    const d =
      (nested as Record<string, unknown>).error_description ??
      (nested as Record<string, unknown>).message;
    if (typeof d === "string") return d;
  }
  return undefined;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function parseJson(response: Response, url: string): Promise<unknown> {
  const text = await safeText(response);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError(
      `Expected JSON from ${url} but received non-JSON content.`,
      {
        exitCode: ExitCode.Api,
      },
    );
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
