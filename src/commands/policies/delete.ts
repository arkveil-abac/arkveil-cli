import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeletePolicyOptions {
  yes?: boolean;
}

/** Delete a policy (DELETE /navigation/targets/{targetNodeId}/policies/{policyId}). */
export async function deletePolicy(
  ctx: CliContext,
  targetNodeId: string,
  policyId: string,
  options: DeletePolicyOptions,
): Promise<void> {
  await confirmAction(ctx, `Delete policy ${policyId}? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting policy ${policyId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/targets/{targetNodeId}/policies/{policyId}", {
        params: { path: { targetNodeId, policyId } },
      }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete policy.");
    throw err;
  }
  ctx.out.success(`Deleted policy ${policyId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
