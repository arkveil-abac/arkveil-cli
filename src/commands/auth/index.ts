import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { login } from "./login.js";
import { logout } from "./logout.js";
import { whoami } from "./whoami.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Authenticate with the Arkveil API (device flow)");

  auth
    .command("login")
    .description("Authenticate via the device authorization flow")
    .option("--no-browser", "do not open the verification URL in a browser")
    .addHelpText(
      "after",
      "\nExample:\n  $ arkveil auth login\n  $ arkveil auth login --no-browser   # print the URL instead of opening it\n",
    )
    .action(async (options: { browser: boolean }, command: Command) => {
      await run(command, (ctx) => login(ctx, { browser: options.browser }));
    });

  auth
    .command("logout")
    .description("Remove stored credentials")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => logout(ctx));
    });

  auth
    .command("whoami")
    .description("Show the current authentication state")
    .option("--no-verify", "do not verify the token against the API")
    .action(async (options: { verify: boolean }, command: Command) => {
      await run(command, (ctx) => whoami(ctx, { verify: options.verify }));
    });
}
