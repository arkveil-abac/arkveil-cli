import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { seedDemo } from "./seed-demo.js";
import { resetDemo } from "./reset-demo.js";
import { clearWorkspace } from "./clear.js";
import { undoClear } from "./undo-clear.js";

export function registerAdmin(program: Command): void {
  const admin = program.command("admin").description("Workspace administration");

  admin
    .command("seed-demo")
    .description("Create the demo workspace (requires an empty workspace)")
    .addHelpText(
      "after",
      "\nCreates the demo billing model in one shot: 4 actions, 6 targets, 13 policies,\n" +
        "2 datasets and a suite of 14 tests, including dataset tests over\n" +
        "demo_billing.public.invoice — `arkveil tests run-all` should report every\n" +
        "seeded test passing.\n" +
        "\nCreate-only, and it requires an empty workspace: any live action, target,\n" +
        "policy, dataset, datasource, test, tag or navigation folder makes it answer\n" +
        "`Demo seeding requires an empty workspace — clear the workspace first` and\n" +
        "create nothing. A second call is that 400 by design, not a retryable failure —\n" +
        "run `arkveil admin clear` first (or `arkveil admin reset-demo` for both).\n" +
        "\nRoot folders and the user/context attribute schemas do not count as content,\n" +
        "so a freshly cleared workspace is seedable. Nothing auto-seeds: a new\n" +
        "workspace stays empty until this command is run.\n",
    )
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => seedDemo(ctx));
    });

  admin
    .command("clear")
    .description("DESTRUCTIVE: clear all workspace authorization data, leaving the workspace empty")
    .option("-y, --yes", "skip the confirmation prompt")
    .addHelpText(
      "after",
      "\nHard-deletes every policy, target, dataset, datasource, action, test, tag and\n" +
        "navigation node. The DAGs and their root folders, API keys, users, and the\n" +
        "user and context attribute schemas survive. Nothing is reseeded afterwards —\n" +
        "run `arkveil admin seed-demo` if you want demo data back, or apply your own\n" +
        "manifest onto the blank workspace.\n" +
        "\nRecoverable: `arkveil admin undo-clear` restores the last clear for as long as\n" +
        "the workspace stays empty. Clearing an already-empty workspace is a no-op that\n" +
        "records nothing, so it cannot consume an existing undo.\n",
    )
    .action(async (options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => clearWorkspace(ctx, options));
    });

  admin
    .command("undo-clear")
    .description("Restore the last `admin clear`, while the workspace is still empty")
    .addHelpText(
      "after",
      "\nRestores every entity under its original id, with the trees in their previous\n" +
        "shape. Deliberately narrow:\n" +
        "\n  · the last clear only — there is no undo stack to walk back further\n" +
        "  · the workspace must still be empty, so anything seeded or authored since\n" +
        "    the clear closes the window (as does a second undo)\n" +
        "  · test runs and their results are not restored\n" +
        "\nWhen the window has closed the server says which precondition failed and the\n" +
        "command exits non-zero. That is final — there is nothing to retry.\n",
    )
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => undoClear(ctx));
    });

  admin
    .command("reset-demo")
    .description("DESTRUCTIVE: clear all workspace authorization data and reseed demo data")
    .option("-y, --yes", "skip the confirmation prompt")
    .addHelpText(
      "after",
      "\n`clear` followed by `seed-demo`, issued back to back — there is no server-side\n" +
        "reset. The seed step spends the undo the clear creates, so `arkveil admin\n" +
        "undo-clear` cannot walk a reset back. Clear on its own if you want that door\n" +
        "left open.\n",
    )
    .action(async (options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => resetDemo(ctx, options));
    });
}
