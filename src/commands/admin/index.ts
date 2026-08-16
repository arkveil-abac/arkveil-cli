import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { seedDemo } from "./seed-demo.js";
import { resetDemo } from "./reset-demo.js";
import { wipeWorkspace } from "./wipe.js";

export function registerAdmin(program: Command): void {
  const admin = program.command("admin").description("Workspace administration");

  admin
    .command("seed-demo")
    .description("Reseed demo data (idempotent; preserves existing entities)")
    .addHelpText(
      "after",
      "\nSeeds the demo billing model: actions, action and data policies, and a test\n" +
        "suite including dataset tests over demo_billing.public.invoice —\n" +
        "`arkveil tests run-all` should report every seeded test passing.\n" +
        "\nOne seeded ownership rule uses the short reference `exists invoice where …`,\n" +
        "so seeding into a workspace that already defines its own dataset with table\n" +
        "name `invoice` fails with an ambiguity 400. Use `arkveil admin reset-demo`\n" +
        "(it wipes user datasets first) in that case.\n",
    )
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

  admin
    .command("wipe")
    .description("DESTRUCTIVE: wipe all workspace authorization data, leaving the workspace empty")
    .option("-y, --yes", "skip the confirmation prompt")
    .addHelpText(
      "after",
      "\nHard-deletes every policy, target, dataset, datasource, action, test, tag and\n" +
        "navigation node. The organization, users, API keys, the DAGs and their root\n" +
        "folders survive. Unlike `reset-demo`, nothing is reseeded afterwards and the\n" +
        "workspace will not auto-seed on the next sign-in — use `arkveil admin seed-demo`\n" +
        "if you want demo data back.\n",
    )
    .action(async (options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => wipeWorkspace(ctx, options));
    });
}
