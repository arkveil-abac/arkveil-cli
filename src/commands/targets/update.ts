import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { warnOnFormulas } from "../_lint.js";
import { renderTree } from "../_render.js";
import type { UpdateTargetRequest, ResolvedNavigationTree } from "../../lib/types.js";

export interface UpdateTargetOptions {
  title: string;
  description?: string;
  condition?: string;
  requestSchema?: string;
}

/** Update a navigation target (PUT /navigation/targets/{targetNodeId}). */
export async function updateTarget(
  ctx: CliContext,
  targetNodeId: string,
  options: UpdateTargetOptions,
): Promise<void> {
  const requestSchema =
    options.requestSchema !== undefined
      ? asObject(await readJsonInput(options.requestSchema, "--request-schema"), "--request-schema")
      : undefined;

  warnOnFormulas(ctx, [["--condition", options.condition]]);

  const body: UpdateTargetRequest = {
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.condition !== undefined ? { conditionDsl: options.condition } : {}),
    ...(requestSchema !== undefined ? { requestSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating target ${targetNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/targets/{targetNodeId}", {
        params: { path: { targetNodeId } },
        body,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update target.");
    throw err;
  }
  ctx.out.success(`Updated target ${targetNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
