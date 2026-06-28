import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import type { ApiKeySummaryResponse } from "../../lib/types.js";

/** List the workspace's API keys (GET /workspace/api-keys). */
export async function listKeys(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Fetching API keys…");
  let keys: ApiKeySummaryResponse[];
  try {
    keys = (await unwrap(client.GET("/api/v1/workspace/api-keys"), "GET")) ?? [];
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch API keys.");
    throw err;
  }

  ctx.out.data(keys, (o) => {
    if (keys.length === 0) return o.c.dim("No API keys found.");
    return o.table(
      ["KEY ID", "PREFIX", "STATUS"],
      keys.map((k) => [k.keyId, k.prefix, k.status]),
    );
  });
}
