import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { showForest, showTree } from "./show.js";

export function registerTrees(program: Command): void {
  const trees = program
    .command("trees")
    .description("Inspect navigation trees (read-only)");

  trees
    .command("forest")
    .description("Show every navigation tree (full forest)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showForest(ctx));
    });

  trees
    .command("tests")
    .description("Show the tests navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/tests"));
    });

  trees
    .command("datasources")
    .description("Show the datasources navigation tree (datasets nest under datasources)")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/datasources"));
    });

  trees
    .command("data-policies")
    .description("Show the data-policies navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/data-policies"));
    });

  trees
    .command("actions")
    .description("Show the actions navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/actions"));
    });

  trees
    .command("action-policies")
    .description("Show the action-policies navigation tree")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => showTree(ctx, "/api/v1/navigation/trees/action-policies"));
    });
}
