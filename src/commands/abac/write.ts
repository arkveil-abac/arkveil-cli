import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { Output } from "../../lib/output.js";
import type { WriteChecksRequest, WriteChecksResponse, WriteOperation } from "../../lib/types.js";

export interface WriteOptions {
  datasetCode: string;
  operation: WriteOperation;
  user?: string;
  context?: string;
  ids?: string[];
}

/** Build the write-check SQL for one mutation (POST /abac/conditions/write). */
export async function buildWriteConditions(ctx: CliContext, options: WriteOptions): Promise<void> {
  const body: WriteChecksRequest = {
    datasetCode: options.datasetCode,
    user: parseJsonObjectFlag(options.user, "--user") ?? {},
    context: parseJsonObjectFlag(options.context, "--context") ?? {},
    operation: options.operation,
    ...(options.ids !== undefined ? { ids: options.ids } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Building ${options.operation} write checks…`);
  let result: WriteChecksResponse;
  try {
    result = await unwrap(client.POST("/api/v1/abac/conditions/write", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not build write checks.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const lines = [
      sqlField(o, "touch sql (pre-state)", result.touchSql, "pre-state", options.operation),
      sqlField(o, "result sql (post-state)", result.resultSql, "post-state", options.operation),
    ];
    if (result.reason === "METADATA_MISSING") {
      lines.push(
        o.c.yellow(
          "reason: METADATA_MISSING — the dataset is not registered (config gap, not a policy deny); " +
            "every phase the operation has renders SELECT FALSE.",
        ),
      );
    } else if (result.reason) {
      lines.push(`${o.c.bold("reason:")} ${result.reason}`);
    }
    return lines.join("\n");
  });
}

/**
 * An absent field means the operation has no such phase — never "allow" — so
 * it renders as an explicit absence, not as an empty statement.
 */
function sqlField(
  o: Output,
  label: string,
  sql: string | undefined,
  phase: string,
  operation: WriteOperation,
): string {
  const value = sql ?? o.c.dim(`(absent — ${operation} has no ${phase} phase)`);
  return `${o.c.bold(`${label}:`)}\n${value}`;
}
