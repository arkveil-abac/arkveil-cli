import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { ApiError } from "../../lib/errors.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import { findNodeById, type TreeNode } from "../_resolve.js";
import { fetchImpact } from "./impact.js";
import type { ArkveilClient } from "../../lib/api-client.js";
import type { DatasetDTO, ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteDatasetOptions {
  yes?: boolean;
}

/**
 * Delete a dataset (DELETE /navigation/datasets/{datasetNodeId}).
 *
 * The API refuses (400) while DATA targets are bound to the dataset OR while a
 * permission policy condition reads it, and reports one blocker at a time. On
 * refusal we look the full picture up and print it, so the next step is
 * obvious without a second command.
 */
export async function deleteDataset(
  ctx: CliContext,
  datasetNodeId: string,
  options: DeleteDatasetOptions,
): Promise<void> {
  await confirmAction(ctx, `Delete dataset ${datasetNodeId}? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting dataset ${datasetNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/datasets/{datasetNodeId}", {
        params: { path: { datasetNodeId } },
      }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete dataset.");
    if (err instanceof ApiError && err.status === 400) {
      await explainBlockers(ctx, client, datasetNodeId);
    }
    throw err;
  }
  ctx.out.success(`Deleted dataset ${datasetNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}

/** Best-effort: a failure here must not mask the API error being thrown. */
async function explainBlockers(
  ctx: CliContext,
  client: ArkveilClient,
  datasetNodeId: string,
): Promise<void> {
  try {
    const code = await datasetCodeOf(client, datasetNodeId);
    if (code === undefined) return;
    const impact = await fetchImpact(client, code);
    const policies = impact.referencingPolicies.length;
    const targets = impact.boundTargets.length;
    if (policies + targets === 0) return;
    ctx.out.warn(
      `${code} is referenced by ${policies} policy condition(s) and ${targets} target(s). ` +
        `Run \`arkveil datasets impact ${code}\` for the list; the deletion order is ` +
        "referencing policies → DATA targets → dataset.",
    );
  } catch {
    // The original API error is the useful one; enrichment is optional.
  }
}

async function datasetCodeOf(
  client: ArkveilClient,
  datasetNodeId: string,
): Promise<string | undefined> {
  const tree = await unwrap(client.GET("/api/v1/navigation/trees/datasources"), "GET");
  const node = findNodeById(tree.root as TreeNode, datasetNodeId);
  return (node?.resource as DatasetDTO | undefined)?.code;
}
