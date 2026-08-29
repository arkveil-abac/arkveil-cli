/**
 * A `CliContext` whose API client talks to a scripted fetch instead of the
 * network. Requests go through the real typed client, so the asserted paths are
 * the ones the CLI would actually put on the wire; stdout/stderr are captured so
 * command output can be asserted too.
 */
import { vi } from "vitest";
import { createApiClient } from "../src/lib/api-client.js";
import { Output } from "../src/lib/output.js";
import type { CliContext } from "../src/lib/context.js";
import type { OutputOptions, ResolvedConfig } from "../src/lib/config.js";

const BASE_URL = "http://api.test";

const config: ResolvedConfig = {
  baseUrl: BASE_URL,
  authBaseUrl: `${BASE_URL}/api/auth`,
  clientId: "arkveil-cli",
  scope: undefined,
  deviceCodePath: "/device/code",
  deviceTokenPath: "/device/token",
  timeoutMs: 1000,
  retries: 0,
  configDir: "/tmp/arkveil-test",
  explicitToken: undefined,
  workspaceId: undefined,
};

/** What the scripted server answers. A missing body means an empty 204-style reply. */
export interface Reply {
  status: number;
  body?: unknown;
}

export interface RecordedCall {
  method: string;
  /** Request path, base URL stripped. */
  path: string;
}

export interface Harness {
  ctx: CliContext;
  /** Every request the command issued, in order. */
  calls: RecordedCall[];
  /** Everything written to the data channel. */
  stdout: string[];
  /** Everything written to the status channel (spinners, success, warnings). */
  stderr: string[];
}

/**
 * Build the harness. `route` answers each request; returning undefined answers
 * an empty 200, which is what the admin endpoints do on success.
 */
export function harness(
  route: (call: RecordedCall) => Reply | undefined,
  outputOptions: Partial<OutputOptions> = {},
): Harness {
  const calls: RecordedCall[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];

  capture(process.stdout, stdout);
  capture(process.stderr, stderr);

  vi.stubGlobal("fetch", async (input: Request | string | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const call: RecordedCall = { method: request.method, path: request.url.slice(BASE_URL.length) };
    calls.push(call);
    return toResponse(route(call) ?? { status: 204 });
  });

  const out = new Output({
    json: false,
    quiet: false,
    verbose: false,
    color: false,
    isTty: false,
    ...outputOptions,
  });
  const client = createApiClient({ config, token: "test-token", out });

  const ctx: CliContext = {
    config,
    out,
    token: async () => "test-token",
    getClient: async () => client,
  };

  return { ctx, calls, stdout, stderr };
}

function capture(stream: NodeJS.WriteStream, sink: string[]): void {
  const write = (chunk: unknown): boolean => {
    sink.push(String(chunk));
    return true;
  };
  vi.spyOn(stream, "write").mockImplementation(write as unknown as typeof stream.write);
}

function toResponse(reply: Reply): Response {
  if (reply.body === undefined) return new Response(null, { status: reply.status });
  return new Response(JSON.stringify(reply.body), {
    status: reply.status,
    headers: { "content-type": "application/json" },
  });
}
