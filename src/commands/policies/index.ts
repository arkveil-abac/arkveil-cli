import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createPolicy, type CreatePolicyOptions } from "./create.js";
import { updatePolicy, type UpdatePolicyOptions } from "./update.js";
import { deletePolicy } from "./delete.js";

const POLICY_TYPES = ["PERMISSION", "READ", "TOUCH", "RESULT"];
const POLICY_STATUSES = ["ENABLED", "DISABLED", "DRAFT", "DELETED"];

const TYPES_HELP = `
DATA policies answer three orthogonal questions. READ: which existing rows may
the subject see. TOUCH: which existing rows may enter a mutation — judged on
the pre-state, before the mutation runs. RESULT: which row states may the
subject produce — judged on the post-state, after the mutation, in the same
transaction. TOUCH and RESULT take the same slots (--condition, --filter) plus
--operations, the data operations the policy governs:

  TOUCH    a non-empty subset of UPDATE,DELETE
  RESULT  a non-empty subset of CREATE,UPDATE

--operations is required on TOUCH and RESULT (there is no default) and must be
absent on READ and PERMISSION. Each operation draws on its own union of
grants and fails closed when no applicable policy is in it, so grants compose
per operation: CREATE needs a RESULT policy, DELETE needs a TOUCH policy, and
UPDATE needs both — a subject holding only the TOUCH side cannot update at
all. To grant "manage own X" whole, author the TOUCH and RESULT pair.

\`policies update\` replaces the whole policy: a TOUCH or RESULT update without
--operations is a 400, not "keep the stored set" — read the current set back
from the policy's \`operations\` field first.
`;

const DSL_HELP = `
--condition and --filter use the Arkveil formula DSL. Run \`arkveil formula syntax\`
for the full reference, or \`arkveil formula parse\` to validate a formula.

Dataset columns are read as \`data.<column>\` (the old \`entity.\` namespace was
removed and no longer parses). A PERMISSION condition may also fetch rows:

  --condition 'exists demo_billing.public.invoice where data.id = request.invoiceId and data.owner_id = user.id'

The referenced dataset must already exist, and the reference must be canonical
lowercase — DSL text is not normalized server-side. A bare table name resolves
against the workspace's live datasets at save time and must match exactly one;
prefer the full datasource.schema.table code in anything repeatable. Every save
re-resolves, so an unchanged policy can newly fail if a same-named dataset
appeared since. Each policy reports what it bound as \`referencedDatasetCodes\`.
`;

export function registerPolicies(program: Command): void {
  const policies = program
    .command("policies")
    .description("Manage policies attached to a target");

  policies
    .command("create <targetNodeId>")
    .description("Create a policy under a target")
    .addOption(new Option("--type <type>", "policy type").choices(POLICY_TYPES).makeOptionMandatory())
    .addOption(new Option("--status <status>", "policy status").choices(POLICY_STATUSES).makeOptionMandatory())
    .requiredOption("--title <title>", "policy title")
    .option("--description <text>", "description")
    .option("--condition <dsl>", "condition DSL")
    .option("--filter <dsl>", "filter DSL (data policies)")
    .option(
      "--operations <operations>",
      "data operations governed, comma-separated (required on TOUCH and RESULT)",
    )
    .addHelpText("after", TYPES_HELP)
    .addHelpText("after", DSL_HELP)
    .action(async (targetNodeId: string, options: CreatePolicyOptions, command: Command) => {
      await run(command, (ctx) => createPolicy(ctx, targetNodeId, options));
    });

  policies
    .command("update <targetNodeId> <policyId>")
    .description("Update a policy")
    .addOption(new Option("--status <status>", "policy status").choices(POLICY_STATUSES).makeOptionMandatory())
    .requiredOption("--title <title>", "policy title")
    .option("--description <text>", "description")
    .option("--condition <dsl>", "condition DSL")
    .option("--filter <dsl>", "filter DSL (data policies)")
    .option(
      "--operations <operations>",
      "data operations governed, comma-separated (required on TOUCH and RESULT; full-replace, never merged)",
    )
    .addHelpText("after", TYPES_HELP)
    .addHelpText("after", DSL_HELP)
    .action(
      async (targetNodeId: string, policyId: string, options: UpdatePolicyOptions, command: Command) => {
        await run(command, (ctx) => updatePolicy(ctx, targetNodeId, policyId, options));
      },
    );

  policies
    .command("delete <targetNodeId> <policyId>")
    .description("Delete a policy")
    .option("-y, --yes", "skip the confirmation prompt")
    .action(async (targetNodeId: string, policyId: string, options: { yes?: boolean }, command: Command) => {
      await run(command, (ctx) => deletePolicy(ctx, targetNodeId, policyId, options));
    });
}
