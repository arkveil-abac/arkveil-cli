import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { WriteChecksRequest, WriteChecksResponse } from "../../lib/types.js";

export interface WriteOptions {
  datasetId: string;
  user?: string;
  context?: string;
  id?: string[];
}

/** Build write SQL conditions and invariants (POST /abac/conditions/write). */
export async function buildWriteConditions(ctx: CliContext, options: WriteOptions): Promise<void> {
  const body: WriteChecksRequest = {
    datasetId: options.datasetId,
    user: parseJsonObjectFlag(options.user, "--user") ?? {},
    context: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.id && options.id.length > 0 ? { ids: options.id } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Building write conditions…");
  let result: WriteChecksResponse;
  try {
    result = await unwrap(client.POST("/api/v1/abac/conditions/write", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not build write conditions.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const invariants = result.invariantSql ?? [];
    const lines = [`${o.c.bold("write sql:")}\n${result.writeSql}`];
    lines.push(o.c.bold(`invariant sql (${invariants.length}):`));
    lines.push(invariants.length ? invariants.map((s) => `  • ${s}`).join("\n") : o.c.dim("  (none)"));
    return lines.join("\n");
  });
}
