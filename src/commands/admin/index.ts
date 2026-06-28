import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { seedDemo } from "./seed-demo.js";
import { resetDemo } from "./reset-demo.js";

export function registerAdmin(program: Command): void {
  const admin = program.command("admin").description("Workspace administration");

  admin
    .command("seed-demo")
    .description("Reseed demo data (idempotent; preserves existing entities)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => seedDemo(ctx));
    });

  admin
    .command("reset-demo")
    .description("DESTRUCTIVE: wipe all workspace authorization data and reseed demo data")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => resetDemo(ctx, options));
    });
}
