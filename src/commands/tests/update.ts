import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { buildTestBody, type TestBodyOptions } from "./_body.js";
import type { ResolvedNavigationTree, UpdateTestRequest } from "../../lib/types.js";

/** Update a navigation test (PUT /navigation/tests/{testNodeId}). */
export async function updateTest(
  ctx: CliContext,
  testNodeId: string,
  options: TestBodyOptions,
): Promise<void> {
  const body = await buildTestBody(ctx, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating test ${testNodeId}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PUT("/api/v1/navigation/tests/{testNodeId}", {
        params: { path: { testNodeId } },
        // The generated union names the `type` discriminator after the schema
        // ("ActionAccessTestSpecification"); the wire value is the subtype name.
        body: body as unknown as UpdateTestRequest,
      }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update test.");
    throw err;
  }
  ctx.out.success(`Updated test ${testNodeId}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
