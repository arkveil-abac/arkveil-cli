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
const SPECIFICATION_TYPES = ["ACTION_ACCESS", "DATASET_READ", "DATASET_WRITE"];
const SELECTOR_TYPES = ["ACTION_SET", "FORMULA", "ALL_ACTIONS"];
const EXPECTED_ACCESS = ["GRANTED", "DENIED"];

const SPEC_HELP = `
A test body is root metadata plus one polymorphic specification. --type picks
which one; the flags for the other kinds are rejected rather than ignored.

  ACTION_ACCESS (default)
    --selector-type ACTION_SET|FORMULA|ALL_ACTIONS  (default ALL_ACTIONS)
    --action-code (repeatable, ACTION_SET)   --formula <dsl> (FORMULA)
    --user / --context / --request           --expected-access GRANTED|DENIED
    --must-be-granted-by <policyId> (repeatable)

  DATASET_READ / DATASET_WRITE
    --dataset-code <datasource.schema.table>
    --fixtures <json>    rows for the tested dataset: a row array, or a
                         { "<dataset code>": [rows] } map. Omitted means [] —
                         an empty table, which is a legitimate fixture.
    --expected-pk <pk>   primary key expected visible/writable (repeatable);
                         must name a fixture row. Values are canonicalized
                         locally (UUIDs lowercased, LONG normalized) to match
                         what the server stores.
    --user / --context   (no --request: data policies cannot read request.*)

  --spec <json> passes a whole specification object through instead, for
  anything the flags do not cover. It is the same shape the API echoes back in
  resource.specification.

Names are unique per workspace and there is no upsert: creating a duplicate is
a plain 400. Read the tree first, then create or update by node id.

Examples:
  $ arkveil tests create --parent <folderId> --name "Admins delete articles" \\
      --status ENABLED --selector-type ACTION_SET --action-code articles:delete \\
      --user '{"role":"admin"}' --expected-access GRANTED

  $ arkveil tests create --parent <folderId> --name "Region scoping" \\
      --status ENABLED --type DATASET_READ \\
      --dataset-code demo_billing.public.invoice \\
      --user '{"region":"EU"}' \\
      --fixtures '[{"id":"1","region":"EU"},{"id":"2","region":"US"}]' \\
      --expected-pk 1
`;

const EXIT_CODE_HELP = `
Exit codes (so this works as a CI gate):
  0  every run PASSED
  8  at least one run FAILED — an assertion did not hold
  9  at least one run ERRORed — the test could not run at all (missing action,
     deleted dataset, fixture that no longer matches the schema)
`;

/** Attach the flags shared by `create` and `update`. */
function withTestBodyOptions(command: Command, includeParent: boolean): Command {
  if (includeParent) command.requiredOption("--parent <id>", "parent folder id");
  return command
    .requiredOption("--name <name>", "test name")
    .option("--description <text>", "description")
    .option("--tag <tag>", "tag (repeatable)", collect, [])
    .addOption(new Option("--status <status>", "test status").choices(STATUSES).makeOptionMandatory())
    .addOption(
      new Option("--type <type>", "specification type")
        .choices(SPECIFICATION_TYPES)
        .default("ACTION_ACCESS"),
    )
    .option("--spec <json>", "whole specification: inline JSON, @file, or -")
    .addOption(new Option("--selector-type <type>", "action selector type").choices(SELECTOR_TYPES))
    .option("--action-code <code>", "action code (ACTION_SET selector; repeatable)", collect, [])
    .option("--formula <dsl>", "formula DSL (FORMULA selector)")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--request <json>", "request attributes as JSON object (ACTION_ACCESS only)")
    .addOption(new Option("--expected-access <access>", "expected access outcome").choices(EXPECTED_ACCESS))
    .option("--must-be-granted-by <policyId>", "required granting policy id (repeatable)", collect, [])
    .option("--dataset-code <code>", "canonical dataset code (dataset tests)")
    .option("--fixtures <json>", "fixture rows for the tested dataset (dataset tests)")
    .option("--expected-pk <pk>", "expected visible/writable primary key (repeatable)", collect, [])
    .addHelpText("after", SPEC_HELP);
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
    .description("Run a single test (takes the test RESOURCE id, not its node id)")
    .addHelpText("after", EXIT_CODE_HELP)
    .action(async (testId: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => runTest(ctx, testId));
    });

  tests
    .command("run-all")
    .description("Run every ENABLED test (action and dataset tests alike)")
    .addHelpText("after", EXIT_CODE_HELP)
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
