import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { findDatasourceNode } from "../_resolve.js";
import type {
  CreateDatasourceRequest,
  ResolvedNavigationTree,
  DatasourceDialect,
} from "../../lib/types.js";

export interface CreateDatasourceOptions {
  name: string;
  dialect: DatasourceDialect;
  description?: string;
}

/** Create a datasource (POST /navigation/datasources). */
export async function createDatasource(
  ctx: CliContext,
  options: CreateDatasourceOptions,
): Promise<void> {
  const body: CreateDatasourceRequest = {
    name: options.name,
    dialect: options.dialect,
    ...(options.description !== undefined ? { description: options.description } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating datasource…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.POST("/api/v1/navigation/datasources", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create datasource.");
    throw err;
  }

  const node = findDatasourceNode(tree, options.name);
  ctx.out.success(
    `Created datasource "${options.name}"${node?.id ? ` (node ${node.id})` : ""}.`,
  );
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
