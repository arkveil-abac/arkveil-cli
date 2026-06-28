import { Argument, type Command } from "commander";
import { run } from "../../lib/run.js";
import { sdkInfo } from "./info.js";
import { sdkInstall } from "./install.js";
import { SDK_TARGET_IDS } from "./catalog.js";

const TARGET_CHOICES = SDK_TARGET_IDS as unknown as string[];

export function registerSdk(program: Command): void {
  const sdk = program
    .command("sdk")
    .description("How to install and use the Arkveil SDK (for humans and AI agents)");

  sdk
    .command("info")
    .description("Print SDK install + usage info (all targets, or one)")
    .addArgument(
      new Argument("[target]", "limit to one SDK target").choices(TARGET_CHOICES),
    )
    .addHelpText(
      "after",
      `
Targets:
  nest   NestJS app          (@arkveil/nest)
  node   Node.js / Express   (@arkveil/node)
  core   runtime-agnostic    (arkveil)

For AI agents: \`arkveil sdk info --json\` emits the full machine-readable
catalog — packages, install commands, usage snippets, and the recipe to type
the SDK from your project's attribute schemas (\`arkveil schemas get user|context\`).

Examples:
  $ arkveil sdk info                 # everything
  $ arkveil sdk info nest            # just the NestJS package
  $ arkveil sdk info --json | jq .   # structured output for tooling/agents
`,
    )
    .action(async (target: string | undefined, _options: unknown, command: Command) => {
      await run(command, (ctx) => sdkInfo(ctx, target));
    });

  sdk
    .command("install")
    .description("Print the npm install command for an SDK target")
    .addArgument(
      new Argument("<target>", "SDK target to install").choices(TARGET_CHOICES),
    )
    .addHelpText(
      "after",
      "\nExample:\n  $ arkveil sdk install nest\n  $ eval \"$(arkveil sdk install node)\"\n",
    )
    .action(async (target: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => sdkInstall(ctx, target));
    });
}
