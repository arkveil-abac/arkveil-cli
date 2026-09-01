import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { login } from "./login.js";
import { logout } from "./logout.js";
import { whoami } from "./whoami.js";

function wireLogin(command: Command): void {
  command
    .description("Authenticate via the device authorization flow")
    .option("--no-browser", "do not open the verification URL in a browser")
    .addHelpText(
      "after",
      "\nExample:\n  $ arkveil login\n  $ arkveil login --no-browser   # print the URL instead of opening it\n",
    )
    .action(async (options: { browser: boolean }, command: Command) => {
      await run(command, (ctx) => login(ctx, { browser: options.browser }));
    });
}

function wireLogout(command: Command): void {
  command.description("Remove stored credentials").action(async (_options: unknown, command: Command) => {
    await run(command, (ctx) => logout(ctx));
  });
}

function wireWhoami(command: Command): void {
  command
    .description("Show the current authentication state")
    .option("--no-verify", "do not verify the token against the API")
    .action(async (options: { verify: boolean }, command: Command) => {
      await run(command, (ctx) => whoami(ctx, { verify: options.verify }));
    });
}

export function registerAuth(program: Command): void {
  wireLogin(program.command("login"));
  wireLogout(program.command("logout"));
  wireWhoami(program.command("whoami"));

  // Deprecated spelling, kept working for older docs and scripts.
  const auth = program
    .command("auth", { hidden: true })
    .description("Deprecated: use the top-level login / logout / whoami");
  wireLogin(auth.command("login"));
  wireLogout(auth.command("logout"));
  wireWhoami(auth.command("whoami"));
}
