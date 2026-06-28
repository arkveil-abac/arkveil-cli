import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { collect } from "../_collect.js";
import { createTest, type CreateTestOptions } from "./create.js";
import { updateTest } from "./update.js";
import type { TestBodyOptions } from "./_body.js";
import { setTestStatus } from "./set-status.js";
import { deleteTest } from "./delete.js";
import { runTest } from "./run.js";
import { runAllTests } from "./run-all.js";
import { testHistory } from "./history.js";
import { runInfo } from "./run-info.js";
import type { TestStatus } from "../../lib/types.js";

const STATUSES = ["GENERATED", "DRAFT", "ENABLED", "DISABLED"];
const SELECTOR_TYPES = ["ACTION_SET", "FORMULA", "ALL_ACTIONS"];
const EXPECTED_ACCESS = ["GRANTED", "DENIED"];

/** Attach the flags shared by `create` and `update`. */
function withTestBodyOptions(command: Command, includeParent: boolean): Command {
  if (includeParent) command.requiredOption("--parent <id>", "parent folder id");
  return command
    .requiredOption("--name <name>", "test name")
    .option("--description <text>", "description")
    .option("--tag <tag>", "tag (repeatable)", collect, [])
    .addOption(new Option("--status <status>", "test status").choices(STATUSES).makeOptionMandatory())
    .addOption(
      new Option("--selector-type <type>", "action selector type").choices(SELECTOR_TYPES).makeOptionMandatory(),
    )
    .option("--action-code <code>", "action code (ACTION_SET selector; repeatable)", collect, [])
    .option("--formula <dsl>", "formula DSL (FORMULA selector)")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .addOption(
      new Option("--expected-access <access>", "expected access outcome")
        .choices(EXPECTED_ACCESS)
        .makeOptionMandatory(),
    )
    .option("--must-be-granted-by <policyId>", "required granting policy id (repeatable)", collect, []);
}

export function registerTests(program: Command): void {
  const tests = program.command("tests").description("Create, run, and inspect access tests");

  withTestBodyOptions(tests.command("create").description("Create a test"), true).action(
    async (options: CreateTestOptions, command: Command) => {
      await run(command, (ctx) => createTest(ctx, options));
    },
  );

  withTestBodyOptions(tests.command("update <testNodeId>").description("Update a test"), false).action(
    async (testNodeId: string, options: TestBodyOptions, command: Command) => {
      await run(command, (ctx) => updateTest(ctx, testNodeId, options));
    },
  );

  tests
    .command("set-status <testNodeId>")
    .description("Change a test's status")
    .addOption(new Option("--status <status>", "new status").choices(STATUSES).makeOptionMandatory())
    .action(async (testNodeId: string, options: { status: TestStatus }, command: Command) => {
      await run(command, (ctx) => setTestStatus(ctx, testNodeId, options.status));
    });

  tests
    .command("delete <testNodeId>")
    .description("Delete a test")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (testNodeId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deleteTest(ctx, testNodeId, options));
    });

  tests
    .command("run <testId>")
    .description("Run a single test")
    .action(async (testId: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => runTest(ctx, testId));
    });

  tests
    .command("run-all")
    .description("Run every test")
    .action(async (_options: unknown, command: Command) => {
      await run(command, (ctx) => runAllTests(ctx));
    });

  tests
    .command("history [testId]")
    .description("Show run history (per test, or aggregate when no id is given)")
    .action(async (testId: string | undefined, _options: unknown, command: Command) => {
      await run(command, (ctx) => testHistory(ctx, testId));
    });

  tests
    .command("run-info <runId>")
    .description("Show a single run with per-action results")
    .action(async (runId: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => runInfo(ctx, runId));
    });
}
