import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import type {
  UpdateDatasourceRequest,
  ResolvedNavigationTree,
  DatasourceDialect,
} from "../../lib/types.js";

export interface UpdateDatasourceOptions {
  dialect: DatasourceDialect;
  description?: string;
}

/** Update a datasource (PUT /navigation/datasources/{datasourceNodeId}).
 * The datasource `name` is immutable; only dialect/description can change. */
export async function updateDatasource(
  ctx: CliContext,
  datasourceNodeId: string,
  options: UpdateDatasourceOptions,
): Promise<void> {
  const body: UpdateDatasourceRequest = {
    dialect: options.dialect,
    ...(options.description !== undefined ? { description: options.description } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating datasource ${datasourceNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/datasources/{datasourceNodeId}", {
        params: { path: { datasourceNodeId } },
        body,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update datasource.");
    throw err;
  }
  ctx.out.success(`Updated datasource ${datasourceNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
