import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { renderTree } from "../_render.js";
import type { CreateActionRequest, ResolvedNavigationTree } from "../../lib/types.js";

export interface CreateActionOptions {
  parent: string;
  service: string;
  name: string;
  title: string;
  tag?: string[];
  description?: string;
  requestSchema?: string;
}

/** Create a navigation action (POST /navigation/actions). */
export async function createAction(ctx: CliContext, options: CreateActionOptions): Promise<void> {
  const requestSchema =
    options.requestSchema !== undefined
      ? asObject(await readJsonInput(options.requestSchema, "--request-schema"), "--request-schema")
      : undefined;

  const body: CreateActionRequest = {
    parentFolderId: options.parent,
    service: options.service,
    name: options.name,
    title: options.title,
    tags: options.tag ?? [],
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(requestSchema !== undefined ? { requestSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating action…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.POST("/api/v1/navigation/actions", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create action.");
    throw err;
  }
  ctx.out.success(`Created action ${options.service}:${options.name}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
