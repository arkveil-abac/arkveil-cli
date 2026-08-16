import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree, renderAllTrees } from "../_render.js";
import type { ResolvedNavigationTree } from "../../lib/types.js";

/** Paths of the single-tree DAG views. */
export type SingleTreePath =
  | "/api/v1/navigation/trees/tests"
  | "/api/v1/navigation/trees/datasources"
  | "/api/v1/navigation/trees/data-policies"
  | "/api/v1/navigation/trees/actions"
  | "/api/v1/navigation/trees/action-policies";

/** Show every navigation tree (GET /navigation/trees). */
export async function showAllTrees(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Fetching navigation trees…");
  let trees: ResolvedNavigationTree[];
  try {
    trees = (await unwrap(client.GET("/api/v1/navigation/trees"), "GET")) ?? [];
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch navigation trees.");
    throw err;
  }
  ctx.out.data(trees, (o) => renderAllTrees(o, trees));
}

/** Show a single DAG tree. */
export async function showTree(ctx: CliContext, path: SingleTreePath): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Fetching navigation tree…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.GET(path), "GET");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch navigation tree.");
    throw err;
  }
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
