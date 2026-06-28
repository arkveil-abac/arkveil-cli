import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { createFolder } from "./create.js";
import { updateFolder } from "./update.js";
import { deleteFolder } from "./delete.js";

export function registerFolders(program: Command): void {
  const folders = program.command("folders").description("Manage navigation folders");

  folders
    .command("create")
    .description("Create a folder")
    .requiredOption("--parent <id>", "parent folder id")
    .requiredOption("--title <title>", "folder title")
    .option("--description <text>", "folder description")
    .action(
      async (options: { parent: string; title: string; description?: string }, command: Command) => {
        await run(command, (ctx) => createFolder(ctx, options));
      },
    );

  folders
    .command("update <folderId>")
    .description("Update a folder")
    .requiredOption("--title <title>", "folder title")
    .option("--description <text>", "folder description")
    .action(
      async (folderId: string, options: { title: string; description?: string }, command: Command) => {
        await run(command, (ctx) => updateFolder(ctx, folderId, options));
      },
    );

  folders
    .command("delete <folderId>")
    .description("Delete a folder")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (folderId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteFolder(ctx, folderId, options));
    });
}
