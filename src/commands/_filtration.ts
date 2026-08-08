/**
 * Human-readable rendering of a dataset filtration trace, shared by dataset
 * test results and `eval explain-dataset`.
 *
 * A dataset decision is not granted by one policy the way an action is: every
 * applying data policy contributes a filter, and the DB runs their combination.
 * So the trace reads as two lists — the policies that applied (with their own
 * SQL fragment) and the target-matched ones that did not. Only the flat
 * `renderedFilter` is console material; `formula` / `residual` / `nodeValues`
 * are AST-shaped and belong in `--json`.
 */
import type { Output } from "../lib/output.js";
import type { FiltrationEvaluationDetails } from "../lib/types.js";

/**
 * Render `filtrationDetails` as indented lines. Returns an empty array when
 * there is nothing to show — runs stored before the backend grew filter traces
 * come back with empty evaluations, and an explain view simply has no
 * per-policy fragments then.
 */
export function renderFiltration(
  out: Output,
  details: FiltrationEvaluationDetails | undefined,
  indent = "",
): string[] {
  if (!details) return [];

  const filters = new Map((details.filterEvaluations ?? []).map((f) => [f.policyId ?? "", f]));
  const evaluations = details.policyEvaluations ?? [];

  // An applying policy whose filter is null applies but has no filterEvaluations
  // entry, so the applied set is the union of both sources.
  const appliedIds = [
    ...new Set([
      ...evaluations.filter((e) => e.applicable).map((e) => e.policyId ?? ""),
      ...filters.keys(),
    ]),
  ];
  const notAppliedIds = evaluations
    .filter((e) => e.applicable === false)
    .map((e) => e.policyId ?? "");

  const lines: string[] = [];

  if (appliedIds.length > 0) {
    lines.push(`${indent}${out.c.dim("applied by")}`);
    for (const policyId of appliedIds) {
      const filter = filters.get(policyId);
      let fragment: string;
      if (filter?.error) fragment = out.c.red(`(filter error: ${filter.error})`);
      else if (filter?.renderedFilter) fragment = filter.renderedFilter;
      else fragment = out.c.dim("(no filter)");
      lines.push(`${indent}  policy ${policyId}  ${fragment}`);
    }
  }

  if (notAppliedIds.length > 0) {
    lines.push(`${indent}${out.c.dim("not applied")}`);
    for (const policyId of notAppliedIds) {
      const trace = evaluations.find((e) => e.policyId === policyId)?.conditionTrace;
      const reason = trace?.error
        ? out.c.red(`(condition error: ${trace.error})`)
        : out.c.dim("(condition false)");
      lines.push(`${indent}  policy ${policyId}  ${reason}`);
    }
  }

  return lines;
}
