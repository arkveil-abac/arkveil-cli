import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderRun } from "./_format.js";
import { failOnRunOutcome } from "./_outcome.js";
import type { TestRunDTO } from "../../lib/types.js";

/** Run a single test (POST /tests/{testId}/run). */
export async function runTest(ctx: CliContext, testId: string): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Running test ${testId}…`);
  let run: TestRunDTO;
  try {
    run = await unwrap(client.POST("/api/v1/tests/{testId}/run", { params: { path: { testId } } }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Test run failed to start.");
    throw err;
  }
  ctx.out.data(run, (o) => renderRun(o, run));
  failOnRunOutcome([run]);
}
