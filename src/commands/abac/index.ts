import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { collectList } from "../_collect.js";
import { checkPermission, type CheckOptions } from "./check.js";
import { buildReadCondition, type ReadOptions } from "./read.js";
import { buildWriteConditions, type WriteOptions } from "./write.js";
import { buildTouchCondition, type TouchOptions } from "./touch.js";
import { fetchActionData } from "./action-data.js";

const WRITE_HELP = `
One request per mutation; the response carries one SQL field per phase the
operation has. An absent field means the operation has no such phase — never
"allow":

  CREATE  resultSql only        --ids rejected: created ids exist only after
                                the insert, so the SQL carries an {{ids}}
                                template for the SDK to substitute
  UPDATE  touchSql + resultSql   --ids required, non-empty; inlined in the SQL
  DELETE  touchSql only          --ids required, non-empty; inlined in the SQL

touchSql is the pre-state check and runs before the mutation over the requested
ids; resultSql is the post-state check and runs after it, in the same
transaction, over the rows the mutation affected. reason: METADATA_MISSING
renders every phase the operation has as SELECT FALSE — the dataset is not
registered (a config gap, not a policy deny).

For a predicate-targeted bulk mutation whose ids are unknown until it runs,
compose \`arkveil abac touch\` into its WHERE instead.
`;

const TOUCH_HELP = `
Serves the touch union of one mutation as a bare boolean fragment, meant to be
pasted into a bulk statement's WHERE so rows the subject may not touch are
never touched. FALSE means an empty union — the composed statement touches
nothing, the intended fail-closed composition, not an error. CREATE has no
WHERE to compose and is rejected.

Pick the mode by whether the ids are known before the mutation: known upfront
— check them with \`arkveil abac write\`; named only by a predicate — compose
this filter. A composed bulk UPDATE still owes the RESULT check over the ids
it actually affected: collect them (UPDATE … RETURNING <pk>), then run
\`arkveil abac write --operation UPDATE --ids <those ids>\` and execute its
resultSql only. A bulk DELETE is complete with the filter alone — it has no
result phase.
`;

export function registerAbac(program: Command): void {
  const abac = program.command("abac").description("ABAC SDK operations (permission checks, RLS conditions)");

  abac
    .command("check")
    .description("Check whether a permission is granted")
    .requiredOption("--action-code <code>", "action code to check")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--request <json>", "request attributes as JSON object")
    .addHelpText(
      "after",
      "\nWhen a permission rule reads a dataset (`exists <dataset> where …`), only a\n" +
        "connected runtime can decide it. Arkveil Cloud alone answers granted=false —\n" +
        "fail-safe, not an error. Point --base-url at a sidecar for the real answer.\n",
    )
    .action(async (options: CheckOptions, command: Command) => {
      await run(command, (ctx) => checkPermission(ctx, options));
    });

  abac
    .command("read")
    .description("Build a row-level read SQL condition for a dataset")
    .requiredOption("--dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--alias <alias>", "SQL table alias to use in the condition")
    .action(async (options: ReadOptions, command: Command) => {
      await run(command, (ctx) => buildReadCondition(ctx, options));
    });

  abac
    .command("write")
    .description("Build the write-check SQL of one mutation on a dataset")
    .requiredOption("--dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .addOption(
      new Option("--operation <operation>", "the mutation being checked")
        .choices(["CREATE", "UPDATE", "DELETE"])
        .makeOptionMandatory(),
    )
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option(
      "--ids <ids>",
      "row ids the mutation touches, comma-separated (repeatable; required for UPDATE and DELETE)",
      collectList,
    )
    .addHelpText("after", WRITE_HELP)
    .action(async (options: WriteOptions, command: Command) => {
      await run(command, (ctx) => buildWriteConditions(ctx, options));
    });

  abac
    .command("touch")
    .description("Build the bulk-mutation touch condition to compose into a WHERE clause")
    .requiredOption("--dataset-code <code>", "canonical dataset code (datasource.schema.table)")
    .addOption(
      new Option("--operation <operation>", "the bulk mutation the condition covers")
        .choices(["UPDATE", "DELETE"])
        .makeOptionMandatory(),
    )
    .option("--user <json>", "user attributes as JSON object", "{}")
    .option("--context <json>", "context attributes as JSON object", "{}")
    .option("--alias <alias>", "SQL table alias to use in the condition")
    .addHelpText("after", TOUCH_HELP)
    .action(async (options: TouchOptions, command: Command) => {
      await run(command, (ctx) => buildTouchCondition(ctx, options));
    });

  abac
    .command("action-data <service> <name>")
    .description("Fetch resolved action data")
    .action(async (service: string, name: string, _options: unknown, command: Command) => {
      await run(command, (ctx) => fetchActionData(ctx, service, name));
    });
}
