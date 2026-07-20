import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { collect } from "../_collect.js";
import { checkPermission, type CheckOptions } from "./check.js";
import { buildReadCondition, type ReadOptions } from "./read.js";
import { buildWriteConditions, type WriteOptions } from "./write.js";
import { fetchActionData } from "./action-data.js";

export function registerAbac(program: Command): void {
  const abac = program.command("abac").description("ABAC SDK operations (permission checks, RLS conditions)");

  abac
    .command("check")
    .description("Check whether a permission is granted")
    .requiredOption("--action-code <code>", "action code to check")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--request <json>", "request attributes as JSON object")
    .addHelpText(
      "after",
      "\nWhen a permission rule reads a dataset (`exists <dataset> where …`), only a\n" +
        "connected runtime can decide it: the kernel answers granted=false with\n" +
        "reason=RUNTIME_REQUIRED. Point --base-url at a sidecar for the real answer.\n",
    )
    .action(async (options: CheckOptions, command: Command) => {
      await run(command, (ctx) => checkPermission(ctx, options));
    });

  abac
    .command("read")
    .description("Build a row-level read SQL condition for a dataset")
    .requiredOption("--dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--alias <alias>", "SQL table alias to use in the condition")
    .action(async (options: ReadOptions, command: Command) => {
      await run(command, (ctx) => buildReadCondition(ctx, options));
    });

  abac
    .command("write")
    .description("Build write SQL conditions and invariants for a dataset")
    .requiredOption("--dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--id <id>", "row id to check (repeatable)", collect, [])
    .action(async (options: WriteOptions, command: Command) => {
      await run(command, (ctx) => buildWriteConditions(ctx, options));
    });

  abac
    .command("action-data <service> <name>")
    .description("Fetch resolved action data")
    .action(async (service: string, name: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => fetchActionData(ctx, service, name));
    });
}
