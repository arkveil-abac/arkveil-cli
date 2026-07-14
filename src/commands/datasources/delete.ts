import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteDatasourceOptions {
  yes?: boolean;
}

/** Delete a datasource (DELETE /navigation/datasources/{datasourceNodeId}).
 * The API refuses (400) while datasets still reference the datasource. */
export async function deleteDatasource(
  ctx: CliContext,
  datasourceNodeId: string,
  options: DeleteDatasourceOptions,
): Promise<void> {
  await confirmAction(
    ctx,
    `Delete datasource ${datasourceNodeId}? This cannot be undone.`,
    options,
  );

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting datasource ${datasourceNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/datasources/{datasourceNodeId}", {
        params: { path: { datasourceNodeId } },
      }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete datasource.");
    throw err;
  }
  ctx.out.success(`Deleted datasource ${datasourceNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
