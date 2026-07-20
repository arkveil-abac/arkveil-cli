import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createDataset, type CreateDatasetOptions } from "./create.js";
import { updateDataset, type UpdateDatasetOptions } from "./update.js";
import { deleteDataset } from "./delete.js";
import { datasetImpact } from "./impact.js";

const PK_TYPES = ["UUID", "LONG", "STRING"];

export function registerDatasets(program: Command): void {
  const datasets = program
    .command("datasets")
    .description("Manage datasets (tables under a datasource)");

  datasets
    .command("create")
    .description("Create a dataset under a datasource")
    .requiredOption("--datasource <nodeId>", "datasource node id (see `arkveil trees datasources`)")
    .requiredOption("--db-schema <schema>", "database schema (lowercased server-side; immutable)")
    .requiredOption("--table-name <table>", "table name (lowercased server-side; immutable)")
    .requiredOption("--pk-name <column>", "primary key column name")
    .addOption(new Option("--pk-type <type>", "primary key type").choices(PK_TYPES).makeOptionMandatory())
    .requiredOption("--title <title>", "dataset title")
    .option("--description <text>", "description")
    .option("--data-schema <json>", "data JSON schema: inline JSON, @file, or -")
    .addHelpText(
      "after",
      "\nThe canonical dataset code is `datasource.schema.table` (all lowercase);\n" +
        "DATA targets (--dataset-code), `arkveil abac read/write`, and dataset\n" +
        "tests all take that code. Policy formulas read this dataset's columns as\n" +
        "`data.<column>`, so schema/table names may not be Formula DSL keywords.\n",
    )
    .action(async (options: CreateDatasetOptions, command: Command) => {
      await run(command, (ctx) => createDataset(ctx, options));
    });

  datasets
    .command("update <datasetNodeId>")
    .description("Update a dataset (identity dbSchema/tableName is immutable)")
    .requiredOption("--title <title>", "dataset title")
    .requiredOption("--pk-name <column>", "primary key column name")
    .addOption(new Option("--pk-type <type>", "primary key type").choices(PK_TYPES).makeOptionMandatory())
    .option("--description <text>", "description")
    .option("--data-schema <json>", "data JSON schema: inline JSON, @file, or - (omit = keep current, '{}' = clear)")
    .addHelpText(
      "after",
      "\nSchema edits fail atomically when they invalidate attached policies\n(the error lists the affected policy ids); nothing is applied in that case.\n",
    )
    .action(async (datasetNodeId: string, options: UpdateDatasetOptions, command: Command) => {
      await run(command, (ctx) => updateDataset(ctx, datasetNodeId, options));
    });

  datasets
    .command("impact <datasetCode>")
    .description("Show the targets and policy conditions that block deleting a dataset")
    .addHelpText(
      "after",
      "\nPolicy references come from each policy's `referencedDatasetCodes`, so short\n" +
        "references (`exists invoice where …`) are matched exactly like full codes.\n" +
        "\nExample:\n  $ arkveil datasets impact demo_billing.public.invoice\n",
    )
    .action(async (datasetCode: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => datasetImpact(ctx, datasetCode));
    });

  datasets
    .command("delete <datasetNodeId>")
    .description("Delete a dataset (refused while targets or policy conditions reference it)")
    .option("-y, --yes", "skip the confirmation prompt")
    .addHelpText(
      "after",
      "\nDeletion is blocked by DATA targets bound to the dataset AND by permission\n" +
        "policies whose condition references it. Run `arkveil datasets impact <code>`\n" +
        "first to see exactly what has to go away.\n",
    )
    .action(async (datasetNodeId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteDataset(ctx, datasetNodeId, options));
    });
}
