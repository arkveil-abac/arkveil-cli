import { Argument, type Command } from "commander";
import { run } from "../../lib/run.js";
import { getSchema } from "./get.js";
import { setSchema } from "./set.js";
import type { AttributeSchemaType } from "../../lib/types.js";

const TYPE_CHOICES = ["user", "context", "action"] as const;

export function registerSchemas(program: Command): void {
  const schemas = program
    .command("schemas")
    .description("Manage USER/CONTEXT/ACTION attribute JSON schemas");

  schemas
    .command("get")
    .description("Show the JSON Schema for an attribute type")
    .addArgument(new Argument("<type>", "attribute schema type").choices(TYPE_CHOICES))
    .addHelpText(
      "after",
      "\nTo type the SDK from these schemas (user/context), see the recipe in\n`arkveil sdk info` — fetch with --json, generate TypeScript, and augment\nthe SDK's ArkveilUserRegistry / ArkveilContextRegistry.\n",
    )
    .action(async (type: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => getSchema(ctx, type as AttributeSchemaType));
    });

  schemas
    .command("set")
    .description("Replace the JSON Schema for an attribute type")
    .addArgument(new Argument("<type>", "attribute schema type").choices(TYPE_CHOICES))
    .option("--data <json>", "JSON Schema: inline JSON, @file, or - for stdin")
    .addHelpText("after", "\nExample:\n  $ arkveil schemas set user --data @user-schema.json\n")
    .action(async (type: string, options: { data?: string }, command: Command) => {
      await run(command, (ctx) => setSchema(ctx, type as AttributeSchemaType, options));
    });
}
