import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteDatasetOptions {
  yes?: boolean;
}

/** Delete a dataset (DELETE /navigation/datasets/{datasetNodeId}).
 * The API refuses (400) while DATA targets still reference the dataset. */
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
    throw err;
  }
  ctx.out.success(`Deleted dataset ${datasetNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
