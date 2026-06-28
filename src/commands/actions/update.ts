import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { renderTree } from "../_render.js";
import type { UpdateActionRequest, ResolvedNavigationTree } from "../../lib/types.js";

export interface UpdateActionOptions {
  title: string;
  tag?: string[];
  description?: string;
  requestSchema?: string;
}

/** Update a navigation action (PUT /navigation/actions/{actionNodeId}). */
export async function updateAction(
  ctx: CliContext,
  actionNodeId: string,
  options: UpdateActionOptions,
): Promise<void> {
  const requestSchema =
    options.requestSchema !== undefined
      ? asObject(await readJsonInput(options.requestSchema, "--request-schema"), "--request-schema")
      : undefined;

  const body: UpdateActionRequest = {
    title: options.title,
    tags: options.tag ?? [],
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(requestSchema !== undefined ? { requestSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating action ${actionNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/actions/{actionNodeId}", {
        params: { path: { actionNodeId } },
        body,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update action.");
    throw err;
  }
  ctx.out.success(`Updated action ${actionNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
