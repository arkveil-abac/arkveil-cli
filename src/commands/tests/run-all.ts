import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { runSummaryRow } from "./_format.js";
import type { TestRunDTO } from "../../lib/types.js";

/** Run every test (POST /tests/run-all). */
export async function runAllTests(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Running all tests…");
  let runs: TestRunDTO[];
  try {
    runs = (await unwrap(client.POST("/api/v1/tests/run-all"), "POST")) ?? [];
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not run tests.");
    throw err;
  }

  ctx.out.data(runs, (o) => {
    if (runs.length === 0) return o.c.dim("No tests were run.");
    return o.table(["RUN ID", "STATUS", "PASSED", "FAILED", "ERRORED", "TRIGGERED"], runs.map(runSummaryRow));
  });
}
