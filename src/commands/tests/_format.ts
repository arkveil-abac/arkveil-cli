import type { Output } from "../../lib/output.js";
import type { TestRunDTO } from "../../lib/types.js";

/** Color a run/result status string. */
export function colorStatus(o: Output, status: string): string {
  switch (status) {
    case "PASSED":
    case "GRANTED":
      return o.c.green(status);
    case "FAILED":
    case "ERROR":
    case "INVALID":
    case "DENIED":
      return o.c.red(status);
    case "RUNNING":
      return o.c.yellow(status);
    default:
      return status;
  }
}

/** One-line summary of a run, for tables. */
export function runSummaryRow(run: TestRunDTO): string[] {
  const s = run.summary;
  return [
    run.id,
    run.status,
    `${s.passedCount}/${s.totalActions}`,
    String(s.failedCount),
    String(s.errorCount),
    run.triggeredAt ?? "",
  ];
}

/** Detailed render of a single run. */
export function renderRun(o: Output, run: TestRunDTO): string {
  const lines: string[] = [];
  lines.push(
    o.keyValue([
      ["run id", run.id],
      ["test id", run.testId],
      ["status", colorStatus(o, run.status)],
      ["triggered", run.triggeredAt ?? ""],
      ["completed", run.completedAt ?? ""],
      [
        "summary",
        `${run.summary.passedCount} passed, ${run.summary.failedCount} failed, ${run.summary.errorCount} errored of ${run.summary.totalActions}`,
      ],
    ]),
  );

  const results = run.results ?? [];
  if (results.length > 0) {
    lines.push("");
    lines.push(
      o.table(
        ["ACTION", "PASSED", "EXPECTED", "ACTUAL"],
        results.map((r) => [
          r.actionCode ?? r.datasetId ?? "(n/a)",
          r.passed ? o.c.green("yes") : o.c.red("no"),
          colorStatus(o, r.expectedOutcome),
          colorStatus(o, r.actualOutcome),
        ]),
      ),
    );
  }
  return lines.join("\n");
}
