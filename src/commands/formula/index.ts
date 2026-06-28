import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { parseFormula } from "./parse.js";
import type { ParseFormulaRequest } from "../../lib/types.js";

const CONTEXTS = [
  "ACTION_PERMISSION",
  "ALL_ACTION_PERMISSION",
  "ACTION_TARGET_CONDITION",
  "DATA_TARGET_CONDITION",
  "DATA_TARGET_FILTER",
  "TEST_SELECTOR",
];

export function registerFormula(program: Command): void {
  const formula = program.command("formula").description("Work with the formula DSL");

  formula
    .command("parse")
    .description("Parse a formula DSL string into its AST")
    .requiredOption("--dsl <dsl>", "the formula DSL to parse")
    .addOption(new Option("--context <context>", "evaluation context").choices(CONTEXTS).makeOptionMandatory())
    .option("--request-schema <json>", "request schema: inline JSON, @file, or -")
    .addHelpText(
      "after",
      "\nExample:\n  $ arkveil formula parse --context ACTION_PERMISSION --dsl 'user.role == \"admin\"'\n",
    )
    .action(
      async (
        options: { dsl: string; context: ParseFormulaRequest["context"]; requestSchema?: string },
        command: Command,
      ) => {
        await run(command, (ctx) => parseFormula(ctx, options));
      },
    );
}
