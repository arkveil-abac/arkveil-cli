import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { showSkill } from "./show.js";

const SKILL_HELP = `
The skill defines how an AI agent works with the access model through this
CLI — the authoring workflow and the semantics of the model. It is served by
the kernel you target (GET /api/v1/skill), requires no credentials, and is
always current for that kernel rather than being baked into the CLI.

The markdown goes to stdout and status messages go to stderr, so a redirect
captures a clean document. Install it into the agent's instructions:

  $ arkveil skill >> AGENTS.md                       # or CLAUDE.md
  $ arkveil skill > .claude/skills/arkveil/SKILL.md  # or a skill file the agent loads

Re-fetch after a kernel upgrade — the guide changes with the model. With
--json the document arrives as { "content": "…" }.
`;

export function registerSkill(program: Command): void {
  program
    .command("skill")
    .description("Print the agent skill: how to work with the access model (install it into your agent's instructions)")
    .addHelpText("after", SKILL_HELP)
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showSkill(ctx));
    });
}
