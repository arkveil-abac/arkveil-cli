import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { getSettings } from "./get.js";
import { setSettings, type SetSettingsOptions } from "./set.js";

export function registerSettings(program: Command): void {
  const settings = program.command("settings").description("View and update your user settings");

  settings
    .command("get")
    .description("Show current user settings")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => getSettings(ctx));
    });

  settings
    .command("set")
    .description("Update user settings (theme and/or UI mode)")
    .addOption(new Option("--theme <theme>", "color theme").choices(["LIGHT", "DARK", "SYSTEM"]))
    .addOption(new Option("--ui-mode <mode>", "UI mode").choices(["SIMPLE", "STRUCTURED"]))
    .action(async (options: { theme?: string; uiMode?: string }, command: Command) => {
      await run(command, (ctx) => setSettings(ctx, options as SetSettingsOptions));
    });
}
