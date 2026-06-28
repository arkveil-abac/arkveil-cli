import { Option, type Command } from "commander";
import { run } from "../../lib/run.js";
import { createPolicy, type CreatePolicyOptions } from "./create.js";
import { updatePolicy, type UpdatePolicyOptions } from "./update.js";
import { deletePolicy } from "./delete.js";

const POLICY_TYPES = ["PERMISSION", "READ", "WRITE", "INVARIANT", "PROJECTION"];
const POLICY_STATUSES = ["ENABLED", "DISABLED", "DRAFT", "DELETED"];

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
