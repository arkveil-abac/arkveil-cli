import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { confirmAction } from "../_confirm.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

export interface DeleteFolderOptions {
  yes?: boolean;
}

/** Delete a navigation folder (DELETE /navigation/folders/{folderId}). */
export async function deleteFolder(
  ctx: CliContext,
  folderId: string,
  options: DeleteFolderOptions,
): Promise<void> {
  await confirmAction(ctx, `Delete folder ${folderId} and its contents? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting folder ${folderId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.DELETE("/api/v1/navigation/folders/{folderId}", { params: { path: { folderId } } }),
      "DELETE",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete folder.");
    throw err;
  }
  ctx.out.success(`Deleted folder ${folderId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
