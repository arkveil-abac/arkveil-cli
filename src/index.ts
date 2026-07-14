/**
 * Entry point. Builds the commander program, wires global flags and every
 * resource command group, then parses argv under a single global error handler.
 * No business logic lives here — each command owns its own behavior.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command, CommanderError } from "commander";
import { handleError } from "./lib/run.js";
import { ExitCode } from "./lib/errors.js";

import { registerAuth } from "./commands/auth/index.js";
import { registerHealth } from "./commands/health/index.js";
import { registerKeys } from "./commands/keys/index.js";
import { registerTags } from "./commands/tags/index.js";
import { registerTrees } from "./commands/trees/index.js";
import { registerSettings } from "./commands/settings/index.js";
import { registerSchemas } from "./commands/schemas/index.js";
import { registerSdk } from "./commands/sdk/index.js";
import { registerGenerate } from "./commands/generate/index.js";
import { registerFolders } from "./commands/folders/index.js";
import { registerDatasources } from "./commands/datasources/index.js";
import { registerDatasets } from "./commands/datasets/index.js";
import { registerApply } from "./commands/apply/index.js";
import { registerActions } from "./commands/actions/index.js";
import { registerTargets } from "./commands/targets/index.js";
import { registerPolicies } from "./commands/policies/index.js";
import { registerTests } from "./commands/tests/index.js";
import { registerFormula } from "./commands/formula/index.js";
import { registerEval } from "./commands/eval/index.js";
import { registerAbac } from "./commands/abac/index.js";
import { registerAdmin } from "./commands/admin/index.js";
import { registerUpdate } from "./commands/update/index.js";

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(
      readFileSync(join(here, "..", "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("arkveil")
    .description("Command-line interface for the Arkveil Kernel API.")
    .version(readVersion(), "-V, --version", "print the CLI version")
    .option("--json", "output machine-readable JSON (disables spinners/color)")
    .option("-q, --quiet", "suppress non-essential output")
    .option("-v, --verbose", "print verbose diagnostics to stderr")
    .option("--no-color", "disable colored output")
    .option(
      "--base-url <url>",
      "API base URL (default https://api.arkveil.com)",
    )
    .option(
      "--api-key <token>",
      "bearer token to use, overriding stored credentials",
    )
    .option(
      "--workspace <id>",
      "workspace id, sent as X-Workspace-Id on every request",
    )
    .option("--config-dir <dir>", "directory for config and credentials")
    .option("--timeout <ms>", "per-request timeout in milliseconds")
    .showHelpAfterError("(add --help for usage)")
    .showSuggestionAfterError();

  // Resource command groups.
  registerAuth(program);
  registerHealth(program);
  registerKeys(program);
  registerTags(program);
  registerTrees(program);
  registerFolders(program);
  registerDatasources(program);
  registerDatasets(program);
  registerApply(program);
  registerActions(program);
  registerTargets(program);
  registerPolicies(program);
  registerTests(program);
  registerSettings(program);
  registerSchemas(program);
  registerSdk(program);
  registerGenerate(program);
  registerFormula(program);
  registerEval(program);
  registerAbac(program);
  registerAdmin(program);
  registerUpdate(program);

  program.addHelpText(
    "after",
    `
Examples:
  $ arkveil auth login                       Authenticate via device flow
  $ arkveil health                           Check API connectivity
  $ arkveil tags list --json                 List tags as JSON
  $ arkveil trees forest                     Show the full navigation forest
  $ arkveil sdk info                         How to install & use the SDK
  $ arkveil update                           Update the CLI to the latest release
  $ arkveil formula syntax                   Print the formula DSL reference
  $ arkveil eval explain -a orders:read \\
      --user '{"role":"admin"}' --context '{}'   Explain an access decision

Global flags (--json, --quiet, --verbose, --no-color, --base-url, --api-key)
apply to every command. Config precedence: flags > env (ARKVEIL_*) > config file > defaults.
`,
  );

  return program;
}

/** Apply exitOverride to a command and all its descendants so parse errors
 * throw (and route through our handler) instead of calling process.exit. */
function applyExitOverrideDeep(command: Command): void {
  command.exitOverride();
  for (const sub of command.commands) applyExitOverrideDeep(sub);
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  applyExitOverrideDeep(program);

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      // Help/version are not failures.
      if (
        err.code === "commander.helpDisplayed" ||
        err.code === "commander.help" ||
        err.code === "commander.version"
      ) {
        process.exitCode = ExitCode.Success;
        return;
      }
      // Everything else from commander is a usage error. The message was
      // already written to stderr by commander.
      process.exitCode = ExitCode.Usage;
      return;
    }
    process.exitCode = handleError(err);
  }
}

main();
