import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createPolicy, type CreatePolicyOptions } from "./create.js";
import { updatePolicy, type UpdatePolicyOptions } from "./update.js";
import { deletePolicy } from "./delete.js";

const POLICY_TYPES = ["PERMISSION", "READ", "WRITE", "INVARIANT", "PROJECTION"];
const POLICY_STATUSES = ["ENABLED", "DISABLED", "DRAFT", "DELETED"];

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
    .option("--projection <json>", "projection: inline JSON, @file, or -")
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
    .option("--projection <json>", "projection: inline JSON, @file, or -")
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
