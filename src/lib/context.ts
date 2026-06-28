/**
 * Per-invocation runtime context: resolved config, output renderer, and a lazily
 * constructed API client. Commands receive a `CliContext` and never touch global
 * state or read env/flags directly.
 */
import { resolveConfig, resolveOutputOptions } from "./config.js";
import type { GlobalFlags, ResolvedConfig } from "./config.js";
import { Output } from "./output.js";
import { createApiClient, type ArkveilClient } from "./api-client.js";
import { resolveToken, requireToken } from "./auth.js";

export interface ClientOptions {
  /** When true, throw AuthError immediately if no credentials are available. */
  requireAuth?: boolean;
}

export interface CliContext {
  readonly config: ResolvedConfig;
  readonly out: Output;
  /** Resolve the bearer token (explicit flag/env or stored), or undefined. */
  token(): Promise<string | undefined>;
  /** Build (and cache) the typed API client. */
  getClient(options?: ClientOptions): Promise<ArkveilClient>;
}

export function createContext(flags: GlobalFlags): CliContext {
  const config = resolveConfig(flags);
  const out = new Output(resolveOutputOptions(flags));

  let tokenResolved = false;
  let cachedToken: string | undefined;
  let cachedClient: ArkveilClient | undefined;

  async function token(): Promise<string | undefined> {
    if (!tokenResolved) {
      cachedToken = await resolveToken(config, out);
      tokenResolved = true;
    }
    return cachedToken;
  }

  async function getClient(options: ClientOptions = {}): Promise<ArkveilClient> {
    const resolved = options.requireAuth ? await requireToken(config, out) : await token();
    if (!cachedClient) {
      cachedClient = createApiClient({ config, token: resolved, out });
    }
    return cachedClient;
  }

  return { config, out, token, getClient };
}
