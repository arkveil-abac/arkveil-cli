import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import type { ParseFormulaRequest, Expression } from "../../lib/types.js";

export interface ParseFormulaOptions {
  dsl: string;
  context: ParseFormulaRequest["context"];
  requestSchema?: string;
}

/** Parse a formula DSL string into its AST (POST /formulas/parse). */
export async function parseFormula(ctx: CliContext, options: ParseFormulaOptions): Promise<void> {
  const requestSchema =
    options.requestSchema !== undefined
      ? asObject(await readJsonInput(options.requestSchema, "--request-schema"), "--request-schema")
      : undefined;

  const body: ParseFormulaRequest = {
    dsl: options.dsl,
    context: options.context,
    ...(requestSchema !== undefined ? { requestSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Parsing formula…");
  let ast: Expression;
  try {
    ast = await unwrap(client.POST("/api/v1/formulas/parse", { body }), "POST");
    spinner.succeed("Formula parsed.");
  } catch (err) {
    spinner.fail("Could not parse formula.");
    throw err;
  }

  // The AST is a deeply nested discriminated union; the most useful human
  // representation is the formatted JSON itself.
  ctx.out.data(ast, () => JSON.stringify(ast, null, 2));
}
