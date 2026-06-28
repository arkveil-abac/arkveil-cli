import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTree } from "../_render.js";
import type { ResolvedNavigationTree, TestStatus } from "../../lib/types.js";

/** Change a test's status (PATCH /navigation/tests/{testNodeId}/status). */
export async function setTestStatus(
  ctx: CliContext,
  testNodeId: string,
  status: TestStatus,
): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Setting test ${testNodeId} status to ${status}…`);
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(
      client.PATCH("/api/v1/navigation/tests/{testNodeId}/status", {
        params: { path: { testNodeId } },
        body: { status },
      }),
      "PATCH",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update test status.");
    throw err;
  }
  ctx.out.success(`Test ${testNodeId} is now ${status}.`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
