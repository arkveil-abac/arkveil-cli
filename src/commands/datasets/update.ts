import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { renderTree } from "../_render.js";
import type { UpdateDatasetRequest, ResolvedNavigationTree, PkType } from "../../lib/types.js";

export interface UpdateDatasetOptions {
  title: string;
  description?: string;
  pkName: string;
  pkType: PkType;
  dataSchema?: string;
}

/** Update a dataset (PUT /navigation/datasets/{datasetNodeId}).
 * Identity (dbSchema/tableName) is immutable — delete and recreate to change
 * it. `dataSchema` omitted keeps the current schema; `'{}'` clears it. */
export async function updateDataset(
  ctx: CliContext,
  datasetNodeId: string,
  options: UpdateDatasetOptions,
): Promise<void> {
  const dataSchema =
    options.dataSchema !== undefined
      ? asObject(await readJsonInput(options.dataSchema, "--data-schema"), "--data-schema")
      : undefined;

  const body: UpdateDatasetRequest = {
    title: options.title,
    pkName: options.pkName,
    pkType: options.pkType,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(dataSchema !== undefined ? { dataSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating dataset ${datasetNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/datasets/{datasetNodeId}", {
        params: { path: { datasetNodeId } },
        body,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update dataset.");
    throw err;
  }
  ctx.out.success(`Updated dataset ${datasetNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
