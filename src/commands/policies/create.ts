import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { warnOnFormulas } from "../_lint.js";
import { renderPolicies } from "../_render.js";
import { parseOperationsFlag } from "./_operations.js";
import type {
  CreatePolicyRequest,
  PolicyDTO,
  PolicyType,
  PolicyStatus,
} from "../../lib/types.js";

export interface CreatePolicyOptions {
  type: PolicyType;
  status: PolicyStatus;
  title: string;
  description?: string;
  condition?: string;
  filter?: string;
  operations?: string;
}

/** Create a policy under a target (POST /navigation/targets/{targetNodeId}/policies). */
export async function createPolicy(
  ctx: CliContext,
  targetNodeId: string,
  options: CreatePolicyOptions,
): Promise<void> {
  const operations = parseOperationsFlag(options.operations);

  warnOnFormulas(ctx, [
    ["--condition", options.condition],
    ["--filter", options.filter],
  ]);

  const body: CreatePolicyRequest = {
    type: options.type,
    status: options.status,
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.condition !== undefined ? { conditionDsl: options.condition } : {}),
    ...(options.filter !== undefined ? { filterDsl: options.filter } : {}),
    ...(operations !== undefined ? { operations } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating policy…");
  let policy: PolicyDTO;
  try {
    policy = await unwrap(
      client.POST("/api/v1/navigation/targets/{targetNodeId}/policies", {
        params: { path: { targetNodeId } },
        body,
      }),
      "POST",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create policy.");
    throw err;
  }
  ctx.out.success(`Created ${options.type} policy "${options.title}".`);
  ctx.out.data(policy, (o) => renderPolicies(o, [policy]));
}
