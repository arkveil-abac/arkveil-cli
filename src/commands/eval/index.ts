import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { explain, type ExplainOptions } from "./explain.js";

export function registerEval(program: Command): void {
  const evaluation = program.command("eval").description("Evaluate and explain access decisions");

  evaluation
    .command("explain")
    .description("Explain whether an action would be granted")
    .requiredOption("-a, --action-code <code>", "action code to evaluate")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--request <json>", "request attributes as JSON object")
    .addHelpText(
      "after",
      "\nExample:\n  $ arkveil eval explain -a orders:read --user '{\"role\":\"admin\"}' --context '{}'\n",
    )
    .action(async (options: ExplainOptions, command: Command) => {
      await run(command, (ctx) => explain(ctx, options));
    });
}
