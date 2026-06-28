/**
 * Typed API client derived from the OpenAPI spec via openapi-typescript +
 * openapi-fetch. All HTTP concerns (timeout, retry, request-id) come from the
 * instrumented fetch; auth and default headers are injected via middleware.
 */
import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/schema.js";
import type { ResolvedConfig } from "./config.js";
import type { Output } from "./output.js";
import { createInstrumentedFetch, readErrorMessage } from "./http.js";
import { ApiError } from "./errors.js";

export type ArkveilClient = Client<paths>;

export interface ApiClientOptions {
  config: ResolvedConfig;
  /** Bearer token; when undefined, requests are sent unauthenticated. */
  token: string | undefined;
  out: Output;
}

export function createApiClient({ config, token, out }: ApiClientOptions): ArkveilClient {
  const fetchImpl = createInstrumentedFetch({
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    out,
  });

  const client = createClient<paths>({ baseUrl: config.baseUrl, fetch: fetchImpl });

  client.use({
    onRequest({ request }) {
      if (!request.headers.has("Accept")) request.headers.set("Accept", "application/json");
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });

  return client;
}

/** Structural shape of an openapi-fetch result. */
interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Unwrap an openapi-fetch result: return `data` on success, otherwise throw a
 * typed `ApiError` carrying the server message and request id.
 */
export async function unwrap<T>(promise: Promise<FetchResult<T>>, method = "request"): Promise<T> {
  const { data, error, response } = await promise;
  if (response.ok) return data as T;

  const serverMessage = extractMessage(error) ?? (await readErrorMessage(response));
  throw new ApiError({
    status: response.status,
    url: response.url,
    method,
    serverMessage,
    requestId: response.headers.get("x-request-id") ?? undefined,
  });
}

function extractMessage(error: unknown): string | undefined {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  return undefined;
}
