import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { renderTree } from "../_render.js";
import { canonical, datasetNodesUnder, findNodeById, type TreeNode } from "../_resolve.js";
import type {
  CreateDatasetRequest,
  ResolvedNavigationTree,
  DatasetDTO,
  PkType,
} from "../../lib/types.js";

export interface CreateDatasetOptions {
  datasource: string;
  dbSchema: string;
  tableName: string;
  pkName: string;
  pkType: PkType;
  title: string;
  description?: string;
  dataSchema?: string;
}

/** Create a dataset (POST /navigation/datasets). */
export async function createDataset(ctx: CliContext, options: CreateDatasetOptions): Promise<void> {
  const dataSchema =
    options.dataSchema !== undefined
      ? asObject(await readJsonInput(options.dataSchema, "--data-schema"), "--data-schema")
      : undefined;

  const body: CreateDatasetRequest = {
    datasourceNodeId: options.datasource,
    dbSchema: options.dbSchema,
    tableName: options.tableName,
    pkName: options.pkName,
    pkType: options.pkType,
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(dataSchema !== undefined ? { dataSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating dataset…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.POST("/api/v1/navigation/datasets", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create dataset.");
    throw err;
  }

  const node = findCreatedDataset(tree, options);
  const code = node ? (node.resource as DatasetDTO).code : undefined;
  ctx.out.success(
    `Created dataset ${code ?? `${options.dbSchema}.${options.tableName}`}${node?.id ? ` (node ${node.id})` : ""}.`,
  );
  ctx.out.data(tree, (o) => renderTree(o, tree));
}

/** The new dataset nests under its datasource node; match on the canonical
 * schema/table segments since the server lowercases them. */
function findCreatedDataset(
  tree: ResolvedNavigationTree,
  options: CreateDatasetOptions,
): TreeNode | undefined {
  const datasourceNode = findNodeById(tree.root as TreeNode, options.datasource);
  if (!datasourceNode) return undefined;
  return datasetNodesUnder(datasourceNode).find((node) => {
    const resource = node.resource as DatasetDTO;
    return (
      canonical(resource.dbSchema ?? "") === canonical(options.dbSchema) &&
      canonical(resource.tableName ?? "") === canonical(options.tableName)
    );
  });
}
