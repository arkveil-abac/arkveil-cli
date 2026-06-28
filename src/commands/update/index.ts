import { type Command } from "commander";
import { run } from "../../lib/run.js";
import { selfUpdate, type UpdateOptions } from "./update.js";

export function registerUpdate(program: Command): void {
  program
    .command("update")
    .aliases(["upgrade", "self-update"])
    .description("Update the Arkveil CLI to the latest published version")
    .option("--check", "only report whether an update is available; don't install")
    .option("--dry-run", "print the install command that would run, without executing it")
    .option("--tag <tag>", "npm dist-tag to install (default latest)", "latest")
    .option("--use <pm>", "package manager to use: npm, pnpm, yarn, or bun")
    .option("--force", "reinstall even if already on the target version")
    .addHelpText(
      "after",
      `
Checks the npm registry for a newer release of the CLI and upgrades this install
in place using the package manager that installed it (auto-detected; override
with --use). Use --check in scripts/CI to detect a pending update via the exit
output without changing anything.

Examples:
  $ arkveil update                 # upgrade to the latest release
  $ arkveil update --check         # is a newer version available?
  $ arkveil update --dry-run       # show the command without running it
  $ arkveil update --tag next      # install the "next" dist-tag
  $ arkveil update --use pnpm      # force pnpm for the global install
  $ arkveil update --json          # machine-readable result
`,
    )
    .action(async (options: UpdateOptions, command: Command) => {
      await run(command, (ctx) => selfUpdate(ctx, options));
    });
}
