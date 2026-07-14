import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createDatasource, type CreateDatasourceOptions } from "./create.js";
import { updateDatasource, type UpdateDatasourceOptions } from "./update.js";
import { deleteDatasource } from "./delete.js";

const DIALECTS = ["POSTGRES", "MYSQL", "MARIADB", "H2"];

export function registerDatasources(program: Command): void {
  const datasources = program
    .command("datasources")
    .description("Manage datasources (databases whose tables become datasets)");

  datasources
    .command("create")
    .description("Create a datasource")
    .requiredOption("--name <name>", "datasource name (lowercased server-side; immutable)")
    .addOption(new Option("--dialect <dialect>", "SQL dialect").choices(DIALECTS).makeOptionMandatory())
    .option("--description <text>", "description")
    .addHelpText(
      "after",
      "\nThe response is the full datasources tree; the created node id is printed\nand is what `datasources update/delete` take.\n",
    )
    .action(async (options: CreateDatasourceOptions, command: Command) => {
      await run(command, (ctx) => createDatasource(ctx, options));
    });

  datasources
    .command("update <datasourceNodeId>")
    .description("Update a datasource (name is immutable)")
    .addOption(new Option("--dialect <dialect>", "SQL dialect").choices(DIALECTS).makeOptionMandatory())
    .option("--description <text>", "description")
    .action(
      async (datasourceNodeId: string, options: UpdateDatasourceOptions, command: Command) => {
        await run(command, (ctx) => updateDatasource(ctx, datasourceNodeId, options));
      },
    );

  datasources
    .command("delete <datasourceNodeId>")
    .description("Delete a datasource (refused while datasets reference it)")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (datasourceNodeId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteDatasource(ctx, datasourceNodeId, options));
    });
}
