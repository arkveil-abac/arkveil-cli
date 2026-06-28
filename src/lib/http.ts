/**
 * HTTP transport concerns shared by the typed API client and the device-auth
 * flow: per-request timeout, exponential-backoff retry on idempotent methods,
 * request-id propagation, and verbose tracing.
 */
import { randomUUID } from "node:crypto";
import { NetworkError, TimeoutError } from "./errors.js";
import type { Output } from "./output.js";

/** Methods safe to retry automatically (no side effects on repeat). */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

/** Status codes worth retrying for idempotent requests. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

const MAX_BACKOFF_MS = 5_000;

export interface HttpOptions {
  timeoutMs: number;
  /** Number of *additional* attempts after the first, for idempotent methods. */
  retries: number;
  out: Output;
}

export type FetchLike = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Compute the delay before the next attempt, honoring Retry-After when present. */
export function backoffDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }
  const base = 300 * 2 ** (attempt - 1);
  const jitter = Math.random() * 100;
  return Math.min(base + jitter, MAX_BACKOFF_MS);
}

/**
 * Build a `fetch`-compatible function with timeout + retry + request-id. Used
 * both as the transport for openapi-fetch and directly by the device-auth flow.
 */
export function createInstrumentedFetch(opts: HttpOptions): FetchLike {
  return async (input, init) => {
    const request = new Request(input, init);
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
    request.headers.set("x-request-id", requestId);

    const method = request.method.toUpperCase();
    const idempotent = IDEMPOTENT_METHODS.has(method);
    const maxAttempts = idempotent ? opts.retries + 1 : 1;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        opts.out.verbose(`→ ${method} ${request.url} [req ${requestId}] attempt ${attempt}/${maxAttempts}`);
        const response = await fetch(request.clone(), { signal: controller.signal });
        clearTimeout(timer);
        opts.out.verbose(`← ${response.status} ${response.statusText} ${method} ${request.url} [req ${requestId}]`);

        if (idempotent && attempt < maxAttempts && RETRYABLE_STATUS.has(response.status)) {
          const delayMs = backoffDelay(attempt, response.headers.get("retry-after"));
          opts.out.verbose(`retryable status ${response.status}; waiting ${Math.round(delayMs)}ms`);
          await sleep(delayMs);
          continue;
        }
        return response;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
        const timedOut = controller.signal.aborted;

        if (attempt < maxAttempts) {
          const delayMs = backoffDelay(attempt, null);
          opts.out.verbose(
            `${timedOut ? "timeout" : "network error"}: ${describe(err)}; retrying in ${Math.round(delayMs)}ms`,
          );
          await sleep(delayMs);
          continue;
        }

        if (timedOut) throw new TimeoutError(opts.timeoutMs, request.url, err);
        throw new NetworkError(
          `Network request failed: ${describe(err)}`,
          "Check connectivity and that the API base URL is reachable.",
          err,
        );
      }
    }

    /* istanbul ignore next -- loop always returns or throws above */
    throw new NetworkError("Request failed after exhausting retries.", undefined, lastError);
  };
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Best-effort extraction of a human message from an error response body.
 * The spec's `ErrorResponse` has a `{ message }` field.
 */
export async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const text = await response.clone().text();
    if (!text) return undefined;
    try {
      const json = JSON.parse(text) as { message?: unknown; error?: unknown };
      if (typeof json.message === "string") return json.message;
      if (typeof json.error === "string") return json.error;
    } catch {
      // Not JSON — fall through to raw text.
    }
    return text.length > 500 ? `${text.slice(0, 500)}…` : text;
  } catch {
    return undefined;
  }
}
