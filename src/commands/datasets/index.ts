import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createDataset, type CreateDatasetOptions } from "./create.js";
import { updateDataset, type UpdateDatasetOptions } from "./update.js";
import { deleteDataset } from "./delete.js";

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
    .option("--entity-schema <json>", "entity JSON schema: inline JSON, @file, or -")
    .addHelpText(
      "after",
      "\nThe canonical dataset id is `datasource.schema.table` (all lowercase);\nDATA targets and `arkveil abac read/write` take that id.\n",
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
    .option("--entity-schema <json>", "entity JSON schema: inline JSON, @file, or - (omit = keep current, '{}' = clear)")
    .addHelpText(
      "after",
      "\nSchema edits fail atomically when they invalidate attached policies\n(the error lists the affected policy ids); nothing is applied in that case.\n",
    )
    .action(async (datasetNodeId: string, options: UpdateDatasetOptions, command: Command) => {
      await run(command, (ctx) => updateDataset(ctx, datasetNodeId, options));
    });

  datasets
    .command("delete <datasetNodeId>")
    .description("Delete a dataset (refused while DATA targets reference it)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (datasetNodeId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteDataset(ctx, datasetNodeId, options));
    });
}
