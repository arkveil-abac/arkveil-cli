/**
 * Command-side glue for the offline formula checks: run them over whichever
 * DSL flags a command accepts and print the findings as warnings. Warnings
 * only — the server is the authority on what parses; these just make the
 * common stale-manifest failures readable before the request goes out.
 */
import { lintFormula } from "../lib/formula-lint.js";
import type { CliContext } from "../lib/context.js";

export function warnOnFormulas(
  ctx: CliContext,
  formulas: Array<[flag: string, dsl: string | undefined]>,
): void {
  for (const [flag, dsl] of formulas) {
    if (dsl === undefined) continue;
    for (const warning of lintFormula(dsl, flag)) ctx.out.warn(warning);
  }
}
