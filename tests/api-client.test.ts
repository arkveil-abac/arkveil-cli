import { describe, it, expect, vi, afterEach } from "vitest";
import { createApiClient, unwrap } from "../src/lib/api-client.js";
import { ApiError, ExitCode } from "../src/lib/errors.js";
import { Output } from "../src/lib/output.js";
import type { ResolvedConfig } from "../src/lib/config.js";

const out = new Output({ json: false, quiet: true, verbose: false, color: false, isTty: false });

const config: ResolvedConfig = {
  baseUrl: "http://api.test",
  authBaseUrl: "http://api.test/api/auth",
  clientId: "arkveil-cli",
  scope: undefined,
  deviceCodePath: "/device/code",
  deviceTokenPath: "/device/token",
  timeoutMs: 1000,
  retries: 0,
  configDir: "/tmp/x",
  explicitToken: undefined,
  workspaceId: undefined,
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("unwrap", () => {
  it("returns data on a successful response", async () => {
    const data = await unwrap(Promise.resolve({ data: { id: "1" }, response: ok({ id: "1" }) }), "GET");
    expect(data).toEqual({ id: "1" });
  });

  it("throws ApiError with the server message on a 400", async () => {
    const response = new Response(JSON.stringify({ message: "bad input" }), { status: 400 });
    await expect(
      unwrap(Promise.resolve({ error: { message: "bad input" }, response }), "POST"),
    ).rejects.toMatchObject({ status: 400, serverMessage: "bad input", exitCode: ExitCode.Api });
  });

  it("maps 401 to the auth exit code", async () => {
    const response = new Response(JSON.stringify({ message: "unauth" }), { status: 401 });
    const err = await unwrap(Promise.resolve({ error: { message: "unauth" }, response }), "GET").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).exitCode).toBe(ExitCode.Auth);
  });

  it("maps 404 to the not-found exit code", async () => {
    const response = new Response(JSON.stringify({ message: "missing" }), { status: 404 });
    const err = await unwrap(Promise.resolve({ error: { message: "missing" }, response }), "GET").catch((e) => e);
    expect((err as ApiError).exitCode).toBe(ExitCode.NotFound);
  });
});

describe("createApiClient auth header injection", () => {
  it("sends Authorization: Bearer when a token is set", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) => ok({ status: "up" }));
    vi.stubGlobal("fetch", mock);
    const client = createApiClient({ config, token: "secret-token", out });
    await client.GET("/api/v1/health");
    const request = mock.mock.calls[0]![0] as Request;
    expect(request.headers.get("authorization")).toBe("Bearer secret-token");
    expect(request.headers.get("accept")).toBe("application/json");
  });

  it("omits Authorization when no token is set", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) => ok({ status: "up" }));
    vi.stubGlobal("fetch", mock);
    const client = createApiClient({ config, token: undefined, out });
    await client.GET("/api/v1/health");
    const request = mock.mock.calls[0]![0] as Request;
    expect(request.headers.get("authorization")).toBeNull();
  });

  it("sends X-Workspace-Id when a workspace id is configured", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) => ok({ status: "up" }));
    vi.stubGlobal("fetch", mock);
    const client = createApiClient({ config: { ...config, workspaceId: "ws-1" }, token: undefined, out });
    await client.GET("/api/v1/health");
    const request = mock.mock.calls[0]![0] as Request;
    expect(request.headers.get("x-workspace-id")).toBe("ws-1");
  });

  it("omits X-Workspace-Id when no workspace id is configured", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) => ok({ status: "up" }));
    vi.stubGlobal("fetch", mock);
    const client = createApiClient({ config, token: undefined, out });
    await client.GET("/api/v1/health");
    const request = mock.mock.calls[0]![0] as Request;
    expect(request.headers.get("x-workspace-id")).toBeNull();
  });

  it("targets the configured base URL", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) => ok({ status: "up" }));
    vi.stubGlobal("fetch", mock);
    const client = createApiClient({ config, token: undefined, out });
    await client.GET("/api/v1/health");
    const request = mock.mock.calls[0]![0] as Request;
    expect(request.url).toBe("http://api.test/api/v1/health");
  });
});
