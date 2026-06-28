import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { runSummaryRow } from "./_format.js";
import type { TestRunHistoryResponse } from "../../lib/types.js";

/**
 * Show run history. With a testId, lists runs for that test
 * (GET /tests/{testId}/runs); without one, shows the aggregate workspace
 * history (GET /tests/runs).
 */
export async function testHistory(ctx: CliContext, testId: string | undefined): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Fetching run history…");

  try {
    if (testId) {
      const runs = (await unwrap(
        client.GET("/api/v1/tests/{testId}/runs", { params: { path: { testId } } }),
        "GET",
      )) ?? [];
      spinner.stop();
      ctx.out.data(runs, (o) => {
        if (runs.length === 0) return o.c.dim("No runs for this test yet.");
        return o.table(
          ["RUN ID", "STATUS", "PASSED", "FAILED", "ERRORED", "TRIGGERED"],
          runs.map(runSummaryRow),
        );
      });
      return;
    }

    const history: TestRunHistoryResponse = await unwrap(client.GET("/api/v1/tests/runs"), "GET");
    spinner.stop();
    ctx.out.data(history, (o) => {
      const runs = history.runs ?? [];
      const header = o.keyValue([
        ["total runs", String(history.totalRuns ?? runs.length)],
        ["passed", String(history.passedRuns ?? "")],
        ["failed", String(history.failedRuns ?? "")],
        ["errored", String(history.errorRuns ?? "")],
        ["invalid", String(history.invalidRuns ?? "")],
        ["pass rate", history.passRate !== undefined ? `${Math.round(history.passRate * 100)}%` : ""],
        ["action coverage", history.actionCoverage !== undefined ? `${Math.round(history.actionCoverage * 100)}%` : ""],
        ["last run", history.lastRunAt ?? ""],
      ]);
      if (runs.length === 0) return header;
      const table = o.table(
        ["RUN ID", "STATUS", "PASSED", "FAILED", "ERRORED", "TRIGGERED"],
        runs.map(runSummaryRow),
      );
      return `${header}\n\n${table}`;
    });
  } catch (err) {
    spinner.fail("Could not fetch run history.");
    throw err;
  }
}
