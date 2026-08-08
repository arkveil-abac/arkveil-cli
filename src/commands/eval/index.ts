import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { explain, type ExplainOptions } from "./explain.js";
import { explainDataset, type ExplainDatasetOptions } from "./explain-dataset.js";

const IMPACTS = ["READ", "WRITE"];

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

  evaluation
    .command("explain-dataset")
    .description("Explain a dataset's row-level condition and which policies filtered it")
    .requiredOption("-d, --dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .addOption(
      new Option("-i, --impact <impact>", "decision to explain").choices(IMPACTS).default("READ"),
    )
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--alias <alias>", "SQL table alias to qualify the rendered condition")
    .addHelpText(
      "after",
      "\nThe `condition` line is the combined SQL the database would run; each\n" +
        "`applied by` line is one policy's own fragment of it. Data policies apply\n" +
        "rather than grant, so there is no \"granted by\" — a policy whose target\n" +
        "matched but whose condition was false shows under `not applied`, and one\n" +
        "whose target never matched does not appear at all. An unknown or unpoliced\n" +
        "dataset answers `FALSE` (no rows) rather than failing.\n" +
        "\nExample:\n" +
        "  $ arkveil eval explain-dataset -d demo_billing.public.invoice \\\n" +
        "      --user '{\"region\":\"EU\"}' --context '{}' --alias t\n" +
        "\nUse --json for the full trace (formula/residual ASTs, node values).\n",
    )
    .action(async (options: ExplainDatasetOptions, command: Command) => {
      await run(command, (ctx) => explainDataset(ctx, options));
    });
}
