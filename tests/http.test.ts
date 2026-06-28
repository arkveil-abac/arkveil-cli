import { describe, it, expect, vi, afterEach } from "vitest";
import { createInstrumentedFetch, backoffDelay, readErrorMessage } from "../src/lib/http.js";
import { NetworkError, TimeoutError } from "../src/lib/errors.js";
import { Output } from "../src/lib/output.js";

const out = new Output({ json: false, quiet: true, verbose: false, color: false, isTty: false });

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createInstrumentedFetch", () => {
  it("attaches an x-request-id header", async () => {
    const mock = vi.fn(async (_input: Request | string | URL, _init?: RequestInit) =>
      jsonResponse(200, { ok: true }),
    );
    vi.stubGlobal("fetch", mock);
    const f = createInstrumentedFetch({ timeoutMs: 1000, retries: 0, out });
    await f("http://api.test/health");
    const sentRequest = mock.mock.calls[0]![0] as Request;
    expect(sentRequest.headers.get("x-request-id")).toBeTruthy();
  });

  it("retries idempotent GET on 503 then succeeds", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { message: "busy" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", mock);
    const f = createInstrumentedFetch({ timeoutMs: 1000, retries: 2, out });
    const res = await f("http://api.test/things", { method: "GET" });
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a POST on 503", async () => {
    const mock = vi.fn(async () => jsonResponse(503, { message: "busy" }));
    vi.stubGlobal("fetch", mock);
    const f = createInstrumentedFetch({ timeoutMs: 1000, retries: 3, out });
    const res = await f("http://api.test/things", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries a network error then throws NetworkError", async () => {
    const mock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    vi.stubGlobal("fetch", mock);
    const f = createInstrumentedFetch({ timeoutMs: 1000, retries: 1, out });
    await expect(f("http://api.test/things", { method: "GET" })).rejects.toBeInstanceOf(NetworkError);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("raises TimeoutError when a request exceeds the timeout", async () => {
    const mock = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", mock);
    const f = createInstrumentedFetch({ timeoutMs: 25, retries: 0, out });
    await expect(f("http://api.test/slow", { method: "GET" })).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("backoffDelay", () => {
  it("honors a numeric Retry-After header", () => {
    expect(backoffDelay(1, "2")).toBe(2000);
  });
  it("grows exponentially and stays bounded", () => {
    const d1 = backoffDelay(1, null);
    const d2 = backoffDelay(2, null);
    expect(d2).toBeGreaterThan(d1);
    expect(backoffDelay(10, null)).toBeLessThanOrEqual(5000);
  });
});

describe("readErrorMessage", () => {
  it("extracts the message field from a JSON error body", async () => {
    const msg = await readErrorMessage(jsonResponse(400, { message: "nope" }));
    expect(msg).toBe("nope");
  });
  it("returns raw text for non-JSON bodies", async () => {
    const msg = await readErrorMessage(new Response("plain failure", { status: 500 }));
    expect(msg).toBe("plain failure");
  });
  it("returns undefined for an empty body", async () => {
    const msg = await readErrorMessage(new Response("", { status: 500 }));
    expect(msg).toBeUndefined();
  });
});
