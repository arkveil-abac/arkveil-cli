import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { listTags } from "./list.js";
import { getTag } from "./get.js";
import { createTag } from "./create.js";
import { updateTag } from "./update.js";
import { deleteTag } from "./delete.js";

export function registerTags(program: Command): void {
  const tags = program.command("tags").description("Manage tags");

  tags
    .command("list")
    .description("List all tags")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => listTags(ctx));
    });

  tags
    .command("get <id>")
    .description("Show a single tag by id")
    .action(async (id: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => getTag(ctx, id));
    });

  tags
    .command("create")
    .description("Create a tag")
    .requiredOption("--slug <slug>", "unique tag slug")
    .requiredOption("--color <color>", "tag color")
    .option("--tooltip <text>", "tooltip text")
    .option("--description <text>", "description")
    .addHelpText("after", "\nExample:\n  $ arkveil tags create --slug pii --color '#e11' --tooltip 'Sensitive'\n")
    .action(
      async (
        options: { slug: string; color: string; tooltip?: string; description?: string },
        command: Command,
      ) => {
        await run(command, (ctx) => createTag(ctx, options));
      },
    );

  tags
    .command("update <id>")
    .description("Update a tag")
    .requiredOption("--color <color>", "tag color (required by the API)")
    .option("--tooltip <text>", "tooltip text")
    .option("--description <text>", "description")
    .action(
      async (
        id: string,
        options: { color: string; tooltip?: string; description?: string },
        command: Command,
      ) => {
        await run(command, (ctx) => updateTag(ctx, id, options));
      },
    );

  tags
    .command("delete <id>")
    .description("Delete a tag")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (id: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteTag(ctx, id, options));
    });
}
