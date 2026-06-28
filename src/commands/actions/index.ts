import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { collect } from "../_collect.js";
import { createAction } from "./create.js";
import { updateAction } from "./update.js";
import { deleteAction } from "./delete.js";

export function registerActions(program: Command): void {
  const actions = program.command("actions").description("Manage navigation actions");

  actions
    .command("create")
    .description("Create an action")
    .requiredOption("--parent <id>", "parent folder id")
    .requiredOption("--service <service>", "service name")
    .requiredOption("--name <name>", "action name")
    .requiredOption("--title <title>", "action title")
    .option("--tag <tag>", "tag slug (repeatable)", collect, [])
    .option("--description <text>", "description")
    .option("--request-schema <json>", "request schema: inline JSON, @file, or -")
    .action(
      async (
        options: {
          parent: string;
          service: string;
          name: string;
          title: string;
          tag?: string[];
          description?: string;
          requestSchema?: string;
        },
        command: Command,
      ) => {
        await run(command, (ctx) => createAction(ctx, options));
      },
    );

  actions
    .command("update <actionNodeId>")
    .description("Update an action")
    .requiredOption("--title <title>", "action title")
    .option("--tag <tag>", "tag slug (repeatable)", collect, [])
    .option("--description <text>", "description")
    .option("--request-schema <json>", "request schema: inline JSON, @file, or -")
    .action(
      async (
        actionNodeId: string,
        options: { title: string; tag?: string[]; description?: string; requestSchema?: string },
        command: Command,
      ) => {
        await run(command, (ctx) => updateAction(ctx, actionNodeId, options));
      },
    );

  actions
    .command("delete <actionNodeId>")
    .description("Delete an action")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (actionNodeId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteAction(ctx, actionNodeId, options));
    });
}
