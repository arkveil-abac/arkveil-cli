import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { showSkill } from "./show.js";

export function registerSkill(program: Command): void {
  program
    .command("skill")
    .description("Print the working guide for the access model (for humans and AI agents)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showSkill(ctx));
    });
}
