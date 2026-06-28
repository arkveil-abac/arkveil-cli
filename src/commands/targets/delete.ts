import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteTargetOptions {
  yes?: boolean;
}

/** Delete a navigation target (DELETE /navigation/targets/{targetNodeId}). */
export async function deleteTarget(
  ctx: CliContext,
  targetNodeId: string,
  options: DeleteTargetOptions,
): Promise<void> {
  await confirmAction(ctx, `Delete target ${targetNodeId} and its policies? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting target ${targetNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/targets/{targetNodeId}", {
        params: { path: { targetNodeId } },
      }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete target.");
    throw err;
  }
  ctx.out.success(`Deleted target ${targetNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
