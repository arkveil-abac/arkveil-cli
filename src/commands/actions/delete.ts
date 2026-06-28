import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteActionOptions {
  yes?: boolean;
}

/** Delete a navigation action (DELETE /navigation/actions/{actionNodeId}). */
export async function deleteAction(
  ctx: CliContext,
  actionNodeId: string,
  options: DeleteActionOptions,
): Promise<void> {
  await confirmAction(ctx, `Delete action ${actionNodeId}? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting action ${actionNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/actions/{actionNodeId}", {
        params: { path: { actionNodeId } },
      }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete action.");
    throw err;
  }
  ctx.out.success(`Deleted action ${actionNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
