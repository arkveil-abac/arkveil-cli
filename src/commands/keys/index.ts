import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { listKeys } from "./list.js";
import { createKey } from "./create.js";

export function registerKeys(program: Command): void {
  const keys = program.command("keys").description("Manage workspace API keys");

  keys
    .command("list")
    .description("List workspace API keys")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => listKeys(ctx));
    });

  keys
    .command("create")
    .description("Create a new workspace API key (secret shown once)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => createKey(ctx));
    });
}
