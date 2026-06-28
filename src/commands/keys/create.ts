import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import type { CreateApiKeyResponse } from "../../lib/types.js";

/** Create a new workspace API key (POST /workspace/api-keys). */
export async function createKey(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating API key…");
  let created: CreateApiKeyResponse;
  try {
    created = await unwrap(client.POST("/api/v1/workspace/api-keys"), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create API key.");
    throw err;
  }

  if (ctx.out.opts.json) {
    ctx.out.json(created);
    return;
  }

  ctx.out.success("API key created.");
  ctx.out.print(
    ctx.out.keyValue([
      ["key id", created.keyId],
      ["status", created.status],
      ["api key", ctx.out.c.bold(created.apiKey)],
    ]),
  );
  ctx.out.warn("Store this key now — the secret is shown only once.");
}
