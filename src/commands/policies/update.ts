import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { warnOnFormulas } from "../_lint.js";
import { renderTree } from "../_render.js";
import { parseOperationsFlag } from "./_operations.js";
import type { UpdatePolicyRequest, ResolvedNavigationTree, PolicyStatus } from "../../lib/types.js";

export interface UpdatePolicyOptions {
  status: PolicyStatus;
  title: string;
  description?: string;
  condition?: string;
  filter?: string;
  operations?: string;
}

/** Update a policy (PUT /navigation/targets/{targetNodeId}/policies/{policyId}). */
export async function updatePolicy(
  ctx: CliContext,
  targetNodeId: string,
  policyId: string,
  options: UpdatePolicyOptions,
): Promise<void> {
  const operations = parseOperationsFlag(options.operations);

  warnOnFormulas(ctx, [
    ["--condition", options.condition],
    ["--filter", options.filter],
  ]);

  const body: UpdatePolicyRequest = {
    status: options.status,
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.condition !== undefined ? { conditionDsl: options.condition } : {}),
    ...(options.filter !== undefined ? { filterDsl: options.filter } : {}),
    ...(operations !== undefined ? { operations } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating policy ${policyId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/targets/{targetNodeId}/policies/{policyId}", {
        params: { path: { targetNodeId, policyId } },
        body,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update policy.");
    throw err;
  }
  ctx.out.success(`Updated policy ${policyId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
