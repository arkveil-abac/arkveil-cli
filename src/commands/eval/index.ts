import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { explain, type ExplainOptions } from "./explain.js";
import { explainDataset, type ExplainDatasetOptions } from "./explain-dataset.js";

const OPERATIONS = ["READ", "CREATE", "UPDATE", "DELETE"];

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
    .description("Explain a data operation's row-level conditions and which policies filtered them")
    .requiredOption("-d, --dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .addOption(
      new Option("-o, --operation <operation>", "data operation to explain")
        .choices(OPERATIONS)
        .makeOptionMandatory(),
    )
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--alias <alias>", "SQL table alias to qualify the rendered conditions")
    .addHelpText(
      "after",
      "\nThe response names one condition per phase the operation has:\n" +
        "READ → read condition; CREATE → result condition; DELETE → touch\n" +
        "condition; UPDATE → touch + result conditions. A phase the operation\n" +
        "lacks is absent — never empty SQL. Each condition is the combined SQL\n" +
        "the database would run; each `applied by` line is one policy's own\n" +
        "fragment (for UPDATE the trace covers both phases). Data policies apply\n" +
        "rather than grant, so there is no \"granted by\" — a policy whose target\n" +
        "matched but whose condition was false shows under `not applied`, and one\n" +
        "whose target never matched does not appear at all. An unknown or\n" +
        "unpoliced dataset answers `FALSE` rather than failing.\n" +
        "\nExample:\n" +
        "  $ arkveil eval explain-dataset -d demo_billing.public.invoice \\\n" +
        "      --operation READ --user '{\"region\":\"EU\"}' --alias t\n" +
        "\nUse --json for the full trace (formula/residual ASTs, node values).\n",
    )
    .action(async (options: ExplainDatasetOptions, command: Command) => {
      await run(command, (ctx) => explainDataset(ctx, options));
    });
}
