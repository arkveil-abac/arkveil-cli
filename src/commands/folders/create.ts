import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import type { CreateFolderRequest, ResolvedNavigationTree } from "../../lib/types.js";

export interface CreateFolderOptions {
  parent: string;
  title: string;
  description?: string;
}

/** Create a navigation folder (POST /navigation/folders). */
export async function createFolder(ctx: CliContext, options: CreateFolderOptions): Promise<void> {
  const body: CreateFolderRequest = {
    parentId: options.parent,
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
  };
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating folder…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.POST("/api/v1/navigation/folders", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create folder.");
    throw err;
  }
  ctx.out.success(`Created folder "${options.title}".`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
