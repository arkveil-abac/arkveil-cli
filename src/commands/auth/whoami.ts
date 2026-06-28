import type { CliContext } from "../../lib/context.js";
import { loadStoredCredentials } from "../../lib/auth.js";
import { AuthError } from "../../lib/errors.js";

export interface WhoamiOptions {
  /** Verify the token against the API (GET /me/settings). Default true. */
  verify: boolean;
}

/**
 * Report the current authentication state. There is no userinfo endpoint in the
 * spec, so identity is shown from stored metadata; `--verify` confirms the token
 * is still accepted by calling an authenticated endpoint.
 */
export async function whoami(ctx: CliContext, options: WhoamiOptions): Promise<void> {
  const { config, out } = ctx;
  const stored = await loadStoredCredentials(config, out);
  const token = config.explicitToken ?? stored?.accessToken;

  if (!token) {
    throw new AuthError("You are not authenticated.");
  }

  const source = config.explicitToken ? "flag/env (--api-key/ARKVEIL_TOKEN)" : "stored credentials";

  let verified: boolean | null = null;
  if (options.verify) {
    const client = await ctx.getClient({ requireAuth: true });
    const { response } = await client.GET("/api/v1/me/settings");
    if (response.status === 401 || response.status === 403) {
      throw new AuthError(
        "Your credentials were rejected by the server.",
        "Run `arkveil auth login` to re-authenticate.",
      );
    }
    verified = response.ok;
    if (!response.ok) out.warn(`Could not verify token (server returned ${response.status}).`);
  }

  const summary = {
    authenticated: true,
    verified,
    source,
    baseUrl: config.baseUrl,
    clientId: stored?.clientId ?? config.clientId,
    storage: stored?.storage ?? "none",
    tokenPreview: `${token.slice(0, 6)}…(${token.length} chars)`,
    obtainedAt: stored?.obtainedAt ?? null,
    expiresAt: stored?.expiresAt ?? null,
  };

  out.data(summary, (o) =>
    o.keyValue([
      ["status", o.c.green("authenticated")],
      ["verified", verified === null ? "(skipped)" : verified ? o.c.green("yes") : o.c.yellow("no")],
      ["source", source],
      ["base url", summary.baseUrl],
      ["client id", summary.clientId],
      ["storage", summary.storage],
      ["token", summary.tokenPreview],
      ["obtained", summary.obtainedAt ?? "(unknown)"],
      ["expires", summary.expiresAt ?? "(unknown)"],
    ]),
  );
}
