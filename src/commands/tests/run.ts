import type { CliContext } from "../../lib/context.js";
import { unwrap, type ArkveilClient } from "../../lib/api-client.js";
import { renderRun } from "./_format.js";
import { failOnRunOutcome } from "./_outcome.js";
import { ApiError } from "../../lib/errors.js";
import type { TestRunDTO } from "../../lib/types.js";

/** Run a single test by node id or resource id. */
export async function runTest(ctx: CliContext, testId: string): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Running test ${testId}…`);
  let run: TestRunDTO;
  try {
    run = await startRun(client, testId);
    spinner.stop();
  } catch (err) {
    spinner.fail("Test run failed to start.");
    throw err;
  }
  ctx.out.data(run, (o) => renderRun(o, run));
  failOnRunOutcome([run]);
}

/**
 * The node endpoint takes a navigation node id, the resource endpoint takes a
 * test resource id, and neither accepts the other kind — so an id of unknown
 * provenance goes to the node route first and falls back to the resource route.
 * A failing fallback surfaces its own error (`Test not found: <uuid>`), which is
 * the accurate one: the id is neither a node nor a test here.
 */
async function startRun(client: ArkveilClient, id: string): Promise<TestRunDTO> {
  try {
    return await unwrap(
      client.POST("/api/v1/navigation/tests/{testNodeId}/run", {
        params: { path: { testNodeId: id } },
      }),
      "POST",
    );
  } catch (err) {
    if (!isResourceIdCandidate(err)) throw err;
    return await unwrap(
      client.POST("/api/v1/tests/{testId}/run", { params: { path: { testId: id } } }),
      "POST",
    );
  }
}

/**
 * 404 — the route is there and the id is not a live test node in this
 * workspace, which is exactly what a resource id looks like. 500 — the kernel
 * predates the node route entirely (an unmapped route answers 500 there, so a
 * 404-only fallback would never fire against an older deployment). Everything
 * else is the real answer, including the 400 for a node of the wrong kind: that
 * node exists, so retrying resolves nothing.
 */
function isResourceIdCandidate(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 500);
}
