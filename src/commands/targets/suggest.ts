import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import type { SuggestRequest, SuggestResponse } from "../../lib/types.js";

export interface SuggestOptions {
  condition: string;
}

/**
 * Suggest a request schema from a condition DSL
 * (POST /targets/request-schema/suggest).
 */
export async function suggestRequestSchema(ctx: CliContext, options: SuggestOptions): Promise<void> {
  const body: SuggestRequest = { conditionDsl: options.condition };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Computing suggestion…");
  let result: SuggestResponse;
  try {
    result = await unwrap(client.POST("/api/v1/targets/request-schema/suggest", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not compute suggestion.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const matched = result.matchedActions ?? [];
    const conflicts = result.typeConflicts ?? [];
    const lines: string[] = [];
    lines.push(o.c.bold(`Matched actions (${matched.length}):`));
    lines.push(matched.length ? matched.map((m) => `  • ${m.actionCode}`).join("\n") : o.c.dim("  (none)"));
    if (conflicts.length) {
      lines.push(o.c.yellow(`Type conflicts (${conflicts.length}):`));
      for (const c of conflicts) {
        const decls = (c.declarations ?? []).map((d) => `${d.actionCode}=${d.type ?? "?"}`).join(", ");
        lines.push(`  • ${c.propertyName}: ${decls}`);
      }
    }
    lines.push(o.c.bold("Intersection schema:"));
    lines.push(JSON.stringify(result.intersection ?? {}, null, 2));
    return lines.join("\n");
  });
}
