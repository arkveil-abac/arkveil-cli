/**
 * What stands between a dataset and its deletion.
 *
 * Two independent blockers, and the server reports them one at a time:
 * DATA targets bound to the dataset, and PERMISSION policies whose condition
 * reads it. The second is computed from `PolicyDTO.referencedDatasetCodes` —
 * the canonical codes a policy binds, recomputed on every save — so a short
 * reference (`exists invoice where …`) is matched exactly like a full one, and
 * no `conditionDsl` parsing is involved.
 */
import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { canonical, walk, type TreeNode } from "../_resolve.js";
import type { ArkveilClient } from "../../lib/api-client.js";
import type { Output } from "../../lib/output.js";
import type { PolicyDTO, ResolvedNavigationTree, TargetDTO } from "../../lib/types.js";

/** The DAGs that can hold a target, and so a policy. */
const POLICY_TREES = [
  "/api/v1/navigation/trees/action-policies",
  "/api/v1/navigation/trees/data-policies",
] as const;

export interface DatasetReference {
  /** Node id of the target, for `arkveil targets delete`. */
  targetNodeId: string | undefined;
  targetTitle: string;
  targetType: TargetDTO["type"];
  /** Set when a policy condition references the dataset; absent for a binding. */
  policy?: { id: string; type: PolicyDTO["type"]; title: string };
}

export interface DatasetImpact {
  datasetCode: string;
  /** DATA targets bound to the dataset via `datasetCode`. */
  boundTargets: DatasetReference[];
  /** Policies whose condition binds the dataset. */
  referencingPolicies: DatasetReference[];
}

/** Report everything that blocks deleting a dataset. */
export async function datasetImpact(ctx: CliContext, code: string): Promise<void> {
  const datasetCode = canonical(code);
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Finding references to ${datasetCode}…`);

  let impact: DatasetImpact;
  try {
    const trees = await Promise.all(
      POLICY_TREES.map((path) => unwrap(client.GET(path), "GET")),
    );
    impact = collectImpact(datasetCode, trees);
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch the policy trees.");
    throw err;
  }

  ctx.out.data(impact, (o) => renderImpact(o, impact));
}

/** Pure: fold the policy DAGs into the blockers for one dataset code. */
export function collectImpact(
  datasetCode: string,
  trees: ResolvedNavigationTree[],
): DatasetImpact {
  const boundTargets: DatasetReference[] = [];
  const referencingPolicies: DatasetReference[] = [];

  for (const tree of trees) {
    for (const node of walk(tree.root as TreeNode)) {
      if (node.resourceType !== "TARGET" || !node.resource) continue;
      const target = node.resource as TargetDTO;
      const base = {
        targetNodeId: node.id,
        targetTitle: target.title,
        targetType: target.type,
      };

      if (target.datasetCode !== undefined && canonical(target.datasetCode) === datasetCode) {
        boundTargets.push(base);
      }
      for (const policy of target.policies ?? []) {
        if (!(policy.referencedDatasetCodes ?? []).includes(datasetCode)) continue;
        referencingPolicies.push({
          ...base,
          policy: { id: policy.id, type: policy.type, title: policy.title },
        });
      }
    }
  }

  return { datasetCode, boundTargets, referencingPolicies };
}

function renderImpact(o: Output, impact: DatasetImpact): string {
  const { boundTargets, referencingPolicies } = impact;
  if (boundTargets.length === 0 && referencingPolicies.length === 0) {
    return o.c.green(`Nothing references ${impact.datasetCode} — it can be deleted.`);
  }

  const lines = [
    o.c.bold(
      `${impact.datasetCode} is referenced by ${boundTargets.length} target(s) and ` +
        `${referencingPolicies.length} policy condition(s).`,
    ),
  ];

  if (referencingPolicies.length > 0) {
    lines.push("");
    lines.push(o.c.bold("Permission policies reading this dataset (delete these first):"));
    lines.push(
      o.table(
        ["POLICY ID", "TYPE", "POLICY", "TARGET"],
        referencingPolicies.map((r) => [
          r.policy?.id ?? "",
          r.policy?.type ?? "",
          r.policy?.title ?? "",
          r.targetTitle,
        ]),
      ),
    );
  }

  if (boundTargets.length > 0) {
    lines.push("");
    lines.push(o.c.bold("DATA targets bound to this dataset (delete these next):"));
    lines.push(
      o.table(
        ["TARGET NODE ID", "TYPE", "TITLE"],
        boundTargets.map((r) => [r.targetNodeId ?? "", r.targetType, r.targetTitle]),
      ),
    );
  }

  lines.push("");
  lines.push(
    o.c.dim("Deletion order: referencing policies → DATA targets → dataset → datasource."),
  );
  return lines.join("\n");
}

/** Fetch the impact without printing, for pre-delete checks. */
export async function fetchImpact(
  client: ArkveilClient,
  datasetCode: string,
): Promise<DatasetImpact> {
  const trees = await Promise.all(POLICY_TREES.map((path) => unwrap(client.GET(path), "GET")));
  return collectImpact(canonical(datasetCode), trees);
}
