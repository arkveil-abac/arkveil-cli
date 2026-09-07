import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { showAllTrees, showTree } from "./show.js";

function wireSubcommands(group: Command): void {
  group
    .command("all")
    .description("Show the whole access model (every navigation tree)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showAllTrees(ctx));
    });

  group
    .command("tests")
    .description("Show the tests navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/tests"));
    });

  group
    .command("datasources")
    .description("Show the datasources navigation tree (datasets nest under datasources)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/datasources"));
    });

  group
    .command("data-policies")
    .description("Show the data-policies navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/data-policies"));
    });

  group
    .command("actions")
    .description("Show the actions navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/actions"));
    });

  group
    .command("action-policies")
    .description("Show the action-policies navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/action-policies"));
    });
}

export function registerModel(program: Command): void {
  const model = program
    .command("model")
    .description("Inspect the access model (read-only navigation trees)");
  wireSubcommands(model);

  // Deprecated spelling, kept working for older docs and scripts.
  const trees = program
    .command("trees", { hidden: true })
    .description("Deprecated: use `arkveil model`");
  wireSubcommands(trees);
}
