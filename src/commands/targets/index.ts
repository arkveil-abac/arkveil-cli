import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createTarget, type CreateTargetOptions } from "./create.js";
import { updateTarget } from "./update.js";
import { deleteTarget } from "./delete.js";
import { suggestRequestSchema } from "./suggest.js";

export function registerTargets(program: Command): void {
  const targets = program.command("targets").description("Manage navigation targets");

  targets
    .command("create")
    .description("Create a target")
    .requiredOption("--parent <id>", "parent folder id")
    .addOption(new Option("--type <type>", "target type").choices(["ACTION", "DATA"]).makeOptionMandatory())
    .addOption(
      new Option("--mode <mode>", "target mode").choices(["INDIVIDUAL", "CUSTOM", "ALL"]).makeOptionMandatory(),
    )
    .requiredOption("--title <title>", "target title")
    .option("--description <text>", "description")
    .option("--action-code <code>", "action code (for ACTION/INDIVIDUAL targets)")
    .option("--dataset-id <id>", "dataset id (for DATA targets)")
    .option("--condition <dsl>", "condition DSL")
    .option("--request-schema <json>", "request schema: inline JSON, @file, or -")
    .action(async (options: CreateTargetOptions, command: Command) => {
      await run(command, (ctx) => createTarget(ctx, options));
    });

  targets
    .command("update <targetNodeId>")
    .description("Update a target")
    .requiredOption("--title <title>", "target title")
    .option("--description <text>", "description")
    .option("--condition <dsl>", "condition DSL")
    .option("--request-schema <json>", "request schema: inline JSON, @file, or -")
    .action(
      async (
        targetNodeId: string,
        options: { title: string; description?: string; condition?: string; requestSchema?: string },
        command: Command,
      ) => {
        await run(command, (ctx) => updateTarget(ctx, targetNodeId, options));
      },
    );

  targets
    .command("delete <targetNodeId>")
    .description("Delete a target")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (targetNodeId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteTarget(ctx, targetNodeId, options));
    });

  targets
    .command("suggest")
    .description("Suggest a request schema from a condition DSL")
    .requiredOption("--condition <dsl>", "condition DSL to analyze")
    .addHelpText("after", "\nExample:\n  $ arkveil targets suggest --condition 'request.amount > 100'\n")
    .action(async (options: { condition: string }, command: Command) => {
      await run(command, (ctx) => suggestRequestSchema(ctx, options));
    });
}
