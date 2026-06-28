import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteTestOptions {
  yes?: boolean;
}

/** Delete a navigation test (DELETE /navigation/tests/{testNodeId}). */
export async function deleteTest(
  ctx: CliContext,
  testNodeId: string,
  options: DeleteTestOptions,
): Promise<void> {
  await confirmAction(ctx, `Delete test ${testNodeId}? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting test ${testNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/tests/{testNodeId}", { params: { path: { testNodeId } } }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete test.");
    throw err;
  }
  ctx.out.success(`Deleted test ${testNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
