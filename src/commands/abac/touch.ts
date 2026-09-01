import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { TouchConditionRequest, TouchConditionResponse, WriteOperation } from "../../lib/types.js";

export interface TouchOptions {
  datasetCode: string;
  operation: WriteOperation;
  user?: string;
  context?: string;
  alias?: string;
}

/**
 * Build the touch union of one bulk mutation as a bare boolean fragment for
 * composing into the statement's WHERE (POST /abac/conditions/touch).
 */
export async function buildTouchCondition(ctx: CliContext, options: TouchOptions): Promise<void> {
  const body: TouchConditionRequest = {
    datasetCode: options.datasetCode,
    user: parseJsonObjectFlag(options.user, "--user") ?? {},
    context: parseJsonObjectFlag(options.context, "--context") ?? {},
    operation: options.operation,
    ...(options.alias !== undefined ? { alias: options.alias } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Building ${options.operation} touch condition…`);
  let result: TouchConditionResponse;
  try {
    result = await unwrap(client.POST("/api/v1/abac/conditions/touch", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not build touch condition.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const lines = [`${o.c.bold("touch condition:")}\n${result.touchCondition}`];
    if (result.reason === "METADATA_MISSING") {
      lines.push(
        o.c.yellow(
          "reason: METADATA_MISSING — the dataset is not registered (config gap, not a policy deny).",
        ),
      );
    } else if (result.reason) {
      lines.push(`${o.c.bold("reason:")} ${result.reason}`);
    } else if (result.touchCondition === "FALSE") {
      lines.push(
        o.c.dim(
          "FALSE = empty touch union: the composed statement touches nothing — " +
            "intended fail-closed composition, not an error.",
        ),
      );
    }
    return lines.join("\n");
  });
}
