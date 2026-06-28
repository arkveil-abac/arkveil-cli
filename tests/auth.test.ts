import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  requestDeviceCode,
  pollForToken,
  saveToken,
  loadStoredCredentials,
  resolveToken,
  clearStoredCredentials,
  __resetKeytarCache,
  type TokenSet,
} from "../src/lib/auth.js";
import { AuthError } from "../src/lib/errors.js";
import { Output } from "../src/lib/output.js";
import type { ResolvedConfig } from "../src/lib/config.js";

// Force the file-based credential store by making the optional keytar import fail.
vi.mock("keytar", () => {
  throw new Error("keytar unavailable in tests");
});

const out = new Output({ json: false, quiet: true, verbose: false, color: false, isTty: false });

let dir: string;
function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    baseUrl: "http://api.test",
    authBaseUrl: "http://api.test/api/auth",
    clientId: "arkveil-cli",
    scope: undefined,
    deviceCodePath: "/device/code",
    deviceTokenPath: "/device/token",
    timeoutMs: 1000,
    retries: 0,
    configDir: dir,
    explicitToken: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "arkveil-auth-"));
  __resetKeytarCache();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("credential store (file)", () => {
  const token: TokenSet = {
    accessToken: "AT-123",
    tokenType: "Bearer",
    refreshToken: "RT-123",
    scope: undefined,
    expiresInSec: 3600,
  };

  it("saves to a 0600 file and reads back the token", async () => {
    const config = makeConfig();
    const stored = await saveToken(config, token, out);
    expect(stored.storage).toBe("file");

    const path = join(dir, "credentials.json");
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);

    const loaded = await loadStoredCredentials(config, out);
    expect(loaded?.accessToken).toBe("AT-123");
    expect(loaded?.refreshToken).toBe("RT-123");
  });

  it("resolveToken returns the stored token", async () => {
    const config = makeConfig();
    await saveToken(config, token, out);
    expect(await resolveToken(config, out)).toBe("AT-123");
  });

  it("resolveToken prefers an explicit token over stored credentials", async () => {
    const config = makeConfig({ explicitToken: "explicit-tok" });
    await saveToken(config, token, out);
    expect(await resolveToken(config, out)).toBe("explicit-tok");
  });

  it("clearStoredCredentials removes the file", async () => {
    const config = makeConfig();
    await saveToken(config, token, out);
    expect(await clearStoredCredentials(config, out)).toBe(true);
    expect(await loadStoredCredentials(config, out)).toBeNull();
    expect(await resolveToken(config, out)).toBeUndefined();
  });
});

describe("device authorization flow", () => {
  it("requestDeviceCode normalizes the response", async () => {
    const mock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          device_code: "dev",
          user_code: "WXYZ-1234",
          verification_uri: "http://api.test/device",
          verification_uri_complete: "http://api.test/device?code=WXYZ-1234",
          expires_in: 300,
          interval: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mock);

    const info = await requestDeviceCode(makeConfig(), out);
    expect(info.deviceCode).toBe("dev");
    expect(info.userCode).toBe("WXYZ-1234");
    expect(info.verificationUri).toBe("http://api.test/device");
    expect(info.verificationUriComplete).toContain("code=");
  });

  it("requestDeviceCode sends a JSON body (better-auth rejects form-encoding)", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          device_code: "dev",
          user_code: "WXYZ-1234",
          verification_uri: "http://api.test/device",
          expires_in: 300,
          interval: 0,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", mock);

    await requestDeviceCode(makeConfig({ scope: "openid" }), out);
    const request = mock.mock.calls[0]![0] as Request;
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(await request.clone().json()).toEqual({ client_id: "arkveil-cli", scope: "openid" });
  });

  it("polls through authorization_pending then returns the token", async () => {
    let tokenCalls = 0;
    const mock = vi.fn(async (input: Request | string | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/device/token")) {
        tokenCalls += 1;
        if (tokenCalls < 2) {
          return new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 });
        }
        return new Response(
          JSON.stringify({ access_token: "AT", token_type: "Bearer", expires_in: 3600, refresh_token: "RT" }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", mock);

    const info = {
      deviceCode: "dev",
      userCode: "WXYZ-1234",
      verificationUri: "http://api.test/device",
      verificationUriComplete: undefined,
      expiresInSec: 300,
      intervalSec: 0,
    };
    const token = await pollForToken(makeConfig(), info, out);
    expect(token.accessToken).toBe("AT");
    expect(token.refreshToken).toBe("RT");
    expect(tokenCalls).toBe(2);
  });

  it("throws AuthError when authorization is denied", async () => {
    const mock = vi.fn(async () => new Response(JSON.stringify({ error: "access_denied" }), { status: 400 }));
    vi.stubGlobal("fetch", mock);

    const info = {
      deviceCode: "dev",
      userCode: "WXYZ-1234",
      verificationUri: "http://api.test/device",
      verificationUriComplete: undefined,
      expiresInSec: 300,
      intervalSec: 0,
    };
    await expect(pollForToken(makeConfig(), info, out)).rejects.toBeInstanceOf(AuthError);
  });
});
