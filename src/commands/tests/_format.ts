import type { Output } from "../../lib/output.js";
import { renderFiltration } from "../_filtration.js";
import type { TestRunDTO, TestResultDTO } from "../../lib/types.js";

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
    `${s.passedCount}/${s.totalCount}`,
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
        `${run.summary.passedCount} passed, ${run.summary.failedCount} failed, ` +
          `${run.summary.errorCount} errored of ${run.summary.totalCount}`,
      ],
    ]),
  );

  const results = run.results ?? [];
  if (results.length > 0) {
    lines.push("");
    lines.push(
      o.table(
        ["SUBJECT", "PASSED", "EXPECTED", "ACTUAL"],
        results.map((r) => [
          subjectOf(r),
          r.passed ? o.c.green("yes") : o.c.red("no"),
          expectedOf(o, r),
          actualOf(o, r),
        ]),
      ),
    );
    // Only dataset results carry a rendered condition, and it is the most
    // useful line when one fails: the exact SQL the decision endpoints would
    // serve for this scenario. A passing one is only worth expanding under
    // --verbose.
    for (const result of results) {
      const outcome = result.datasetOutcome;
      if (!outcome) continue;
      const failed = !result.passed;
      if (!failed && !o.opts.verbose) continue;
      lines.push("");
      lines.push(o.c.bold(`${result.datasetCode ?? "(dataset)"} — ${failed ? "pk diff" : "explain"}`));
      const entries: Array<[string, string]> = [];
      if (failed) {
        entries.push(
          ["expected", formatPks(o, outcome.expectedPks)],
          ["actual", formatPks(o, outcome.actualPks)],
          ["missing", formatPks(o, difference(outcome.expectedPks, outcome.actualPks))],
          ["unexpected", formatPks(o, difference(outcome.actualPks, outcome.expectedPks))],
        );
      }
      entries.push(["condition", outcome.renderedCondition]);
      lines.push(o.keyValue(entries));
      // Which policies produced that condition. Runs stored before the backend
      // grew filter traces have none, and then this adds nothing.
      lines.push(...renderFiltration(o, result.filtrationDetails, "  "));
    }
  }
  return lines.join("\n");
}

/** Exactly one code field is set on a result row: action or dataset. */
function subjectOf(result: TestResultDTO): string {
  return result.actionCode ?? result.datasetCode ?? "(n/a)";
}

function expectedOf(o: Output, result: TestResultDTO): string {
  if (result.expectedOutcome) return colorStatus(o, result.expectedOutcome);
  if (result.datasetOutcome) return `${result.datasetOutcome.expectedPks.length} pk(s)`;
  return o.c.dim("—");
}

/**
 * A dataset result with no `datasetOutcome` is an ERROR — the test could not
 * run at all (deleted dataset, stale fixture) — not a failed comparison.
 */
function actualOf(o: Output, result: TestResultDTO): string {
  if (result.actualOutcome) return colorStatus(o, result.actualOutcome);
  if (result.datasetOutcome) return `${result.datasetOutcome.actualPks.length} pk(s)`;
  return o.c.red("did not run");
}

function formatPks(o: Output, pks: string[]): string {
  return pks.length > 0 ? pks.join(", ") : o.c.dim("(none)");
}

function difference(a: string[], b: string[]): string[] {
  const other = new Set(b);
  return a.filter((value) => !other.has(value));
}
