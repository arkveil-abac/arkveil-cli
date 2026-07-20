import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import { buildTestBody, type TestBodyOptions } from "./_body.js";
import type { CreateTestBody, CreateTestRequest, ResolvedNavigationTree } from "../../lib/types.js";

export interface CreateTestOptions extends TestBodyOptions {
  parent: string;
}

/** Create a navigation test (POST /navigation/tests). */
export async function createTest(ctx: CliContext, options: CreateTestOptions): Promise<void> {
  const body: CreateTestBody = {
    parentFolderId: options.parent,
    ...(await buildTestBody(ctx, options)),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating test…");
  let tree: ResolvedNavigationTree;
  try {
    // The generated union names the `type` discriminator after the schema
    // ("ActionAccessTestSpecification"); the wire value is the subtype name.
    tree = await unwrap(
      client.POST("/api/v1/navigation/tests", { body: body as unknown as CreateTestRequest }),
      "POST",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create test.");
    throw err;
  }
  ctx.out.success(`Created test "${options.name}".`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
