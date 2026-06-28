import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderRun } from "./_format.js";
import type { TestRunDTO } from "../../lib/types.js";

/** Show a single run with its per-action results (GET /tests/runs/{runId}). */
export async function runInfo(ctx: CliContext, runId: string): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Fetching run ${runId}…`);
  let run: TestRunDTO;
  try {
    run = await unwrap(client.GET("/api/v1/tests/runs/{runId}", { params: { path: { runId } } }), "GET");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch run.");
    throw err;
  }
  ctx.out.data(run, (o) => renderRun(o, run));
}
