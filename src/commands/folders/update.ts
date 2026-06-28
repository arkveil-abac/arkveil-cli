import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import type { UpdateFolderRequest, ResolvedNavigationTree } from "../../lib/types.js";

export interface UpdateFolderOptions {
  title: string;
  description?: string;
}

/** Update a navigation folder (PUT /navigation/folders/{folderId}). */
export async function updateFolder(
  ctx: CliContext,
  folderId: string,
  options: UpdateFolderOptions,
): Promise<void> {
  const body: UpdateFolderRequest = {
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
  };
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating folder ${folderId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/folders/{folderId}", {
        params: { path: { folderId } },
        body,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update folder.");
    throw err;
  }
  ctx.out.success(`Updated folder ${folderId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
