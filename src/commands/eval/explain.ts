import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { ExplainRequest, ExplainResultDTO } from "../../lib/types.js";

export interface ExplainOptions {
  actionCode: string;
  user?: string;
  context?: string;
  request?: string;
}

/** Explain an access decision for an action (POST /evaluations/explain). */
export async function explain(ctx: CliContext, options: ExplainOptions): Promise<void> {
  const body: ExplainRequest = {
    actionCode: options.actionCode,
    userAttributes: parseJsonObjectFlag(options.user, "--user") ?? {},
    contextAttributes: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.request !== undefined
      ? { requestAttributes: parseJsonObjectFlag(options.request, "--request") ?? {} }
      : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Explaining access for ${options.actionCode}…`);
  let result: ExplainResultDTO;
  try {
    result = await unwrap(client.POST("/api/v1/evaluations/explain", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not evaluate access.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const details = result.evaluationDetails ?? {};
    const granting = details.grantingPolicyIds ?? [];
    const candidates = details.candidatePolicyIds ?? [];
    const lines = [
      o.keyValue([
        ["action", result.actionCode],
        ["granted", result.granted ? o.c.green("GRANTED") : o.c.red("DENIED")],
        ["granting policies", granting.length ? granting.join(", ") : "(none)"],
        ["candidate policies", String(candidates.length)],
      ]),
    ];
    lines.push(o.c.dim("Re-run with --json for the full evaluation trace."));
    return lines.join("\n");
  });
}
