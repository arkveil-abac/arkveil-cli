import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { ReadConditionRequest, ReadConditionResponse } from "../../lib/types.js";

export interface ReadOptions {
  datasetCode: string;
  user?: string;
  context?: string;
  alias?: string;
}

/** Build a row-level read SQL condition (POST /abac/conditions/read). */
export async function buildReadCondition(ctx: CliContext, options: ReadOptions): Promise<void> {
  const body: ReadConditionRequest = {
    datasetCode: options.datasetCode,
    user: parseJsonObjectFlag(options.user, "--user") ?? {},
    context: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.alias !== undefined ? { alias: options.alias } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Building read condition…");
  let result: ReadConditionResponse;
  try {
    result = await unwrap(client.POST("/api/v1/abac/conditions/read", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not build read condition.");
    throw err;
  }

  const note =
    result.readCondition === "FALSE"
      ? `\n${ctx.out.c.dim("FALSE = no applicable READ policy for this user/context (normal, not an error).")}`
      : "";
  ctx.out.data(result, (o) => `${o.c.bold("read condition:")}\n${result.readCondition}${note}`);
}
