import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput } from "../../lib/input.js";
import { CliError } from "../../lib/errors.js";
import type { Output } from "../../lib/output.js";
import { confirmAction } from "../_confirm.js";
import { findDatasourceNode } from "../_resolve.js";
import { parseManifest, datasetCode } from "./_manifest.js";
import { planApply, describeAction, type Plan, type PlanAction } from "./_plan.js";
import type {
  ArkveilClient,
} from "../../lib/api-client.js";
import type {
  CreateDatasetRequest,
  ResolvedNavigationTree,
  UpdateDatasetRequest,
} from "../../lib/types.js";

export interface ApplyOptions {
  file: string;
  dryRun?: boolean;
  prune?: boolean;
  yes?: boolean;
}

/**
 * Apply a declarative data manifest: read the datasources tree, diff the
 * desired state against it, then create/update/delete in dependency order
 * (datasources before their datasets; prune deletes last).
 */
export async function applyManifest(ctx: CliContext, options: ApplyOptions): Promise<void> {
  const manifest = parseManifest(await readJsonInput(options.file, "--file"));

  const client = await ctx.getClient({ requireAuth: true });
  const fetchSpinner = ctx.out.spinner("Fetching datasources tree…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.GET("/api/v1/navigation/trees/datasources"), "GET");
    fetchSpinner.stop();
  } catch (err) {
    fetchSpinner.fail("Could not fetch the datasources tree.");
    throw err;
  }

  const plan = planApply(manifest, tree, { prune: options.prune === true });

  if (plan.actions.length === 0) {
    ctx.out.success("Already up to date — nothing to apply.");
    ctx.out.data(summarize(plan, { dryRun: options.dryRun === true, applied: 0 }), (o) =>
      renderPlan(o, plan),
    );
    return;
  }

  if (options.dryRun) {
    ctx.out.data(summarize(plan, { dryRun: true, applied: 0 }), (o) => renderPlan(o, plan));
    return;
  }

  const deletions = plan.actions.filter((a) => a.kind === "delete-dataset");
  if (deletions.length > 0) {
    await confirmAction(
      ctx,
      `--prune will delete ${deletions.length} dataset(s) not in the manifest. Continue?`,
      options,
    );
  }

  if (!ctx.out.opts.json) ctx.out.print(renderPlan(ctx.out, plan));

  const spinner = ctx.out.spinner("Applying…");
  let applied = 0;
  try {
    const datasourceNodeIds = new Map<string, string>();
    for (const action of plan.actions) {
      spinner.update(`Applying: ${describeAction(action)}`);
      await execute(client, action, datasourceNodeIds);
      applied += 1;
    }
    spinner.stop();
  } catch (err) {
    const failedAt = plan.actions[applied];
    spinner.fail(`Failed at: ${failedAt ? describeAction(failedAt) : "unknown action"}`);
    if (applied > 0) {
      ctx.out.warn(
        `${applied} of ${plan.actions.length} change(s) were applied before the failure; ` +
          "apply is idempotent, so re-running continues from the current state.",
      );
    }
    throw err;
  }

  ctx.out.success(`Applied ${applied} change(s); ${plan.unchanged.length} already up to date.`);
  if (ctx.out.opts.json) {
    ctx.out.json(summarize(plan, { dryRun: false, applied }));
  }
}

async function execute(
  client: ArkveilClient,
  action: PlanAction,
  datasourceNodeIds: Map<string, string>,
): Promise<void> {
  switch (action.kind) {
    case "create-datasource": {
      const { datasets: _datasets, ...body } = action.datasource;
      const tree = await unwrap(client.POST("/api/v1/navigation/datasources", { body }), "POST");
      const node = findDatasourceNode(tree, action.datasource.name);
      if (!node?.id) {
        throw new CliError(
          `Datasource "${action.datasource.name}" was created but not found in the returned tree.`,
          { hint: "Re-run `arkveil apply` — it continues from the current state." },
        );
      }
      datasourceNodeIds.set(action.datasource.name, node.id);
      return;
    }
    case "update-datasource": {
      await unwrap(
        client.PUT("/api/v1/navigation/datasources/{datasourceNodeId}", {
          params: { path: { datasourceNodeId: action.nodeId } },
          body: {
            dialect: action.datasource.dialect,
            ...(action.datasource.description !== undefined
              ? { description: action.datasource.description }
              : {}),
          },
        }),
        "PUT",
      );
      return;
    }
    case "create-dataset": {
      const datasourceNodeId =
        action.datasourceNodeId ?? datasourceNodeIds.get(action.datasourceName);
      if (!datasourceNodeId) {
        throw new CliError(
          `No node id for datasource "${action.datasourceName}" while creating dataset ` +
            `${datasetCode(action.datasourceName, action.dataset)}.`,
        );
      }
      const body: CreateDatasetRequest = {
        datasourceNodeId,
        dbSchema: action.dataset.dbSchema,
        tableName: action.dataset.tableName,
        pkName: action.dataset.pkName,
        pkType: action.dataset.pkType,
        title: action.dataset.title,
        ...(action.dataset.description !== undefined
          ? { description: action.dataset.description }
          : {}),
        dataSchema: action.dataset.dataSchema,
      };
      await unwrap(client.POST("/api/v1/navigation/datasets", { body }), "POST");
      return;
    }
    case "update-dataset": {
      const body: UpdateDatasetRequest = {
        title: action.dataset.title,
        pkName: action.dataset.pkName,
        pkType: action.dataset.pkType,
        ...(action.dataset.description !== undefined
          ? { description: action.dataset.description }
          : {}),
        dataSchema: action.dataset.dataSchema,
      };
      await unwrap(
        client.PUT("/api/v1/navigation/datasets/{datasetNodeId}", {
          params: { path: { datasetNodeId: action.nodeId } },
          body,
        }),
        "PUT",
      );
      return;
    }
    case "delete-dataset": {
      await unwrap(
        client.DELETE("/api/v1/navigation/datasets/{datasetNodeId}", {
          params: { path: { datasetNodeId: action.nodeId } },
        }),
        "DELETE",
      );
      return;
    }
  }
}

function renderPlan(out: Output, plan: Plan): string {
  const lines: string[] = [];
  const creates = plan.actions.filter((a) => a.kind.startsWith("create")).length;
  const updates = plan.actions.filter((a) => a.kind.startsWith("update")).length;
  const deletes = plan.actions.filter((a) => a.kind.startsWith("delete")).length;
  lines.push(
    out.c.bold(
      `Plan: ${creates} to create, ${updates} to update, ${deletes} to delete, ` +
        `${plan.unchanged.length} unchanged`,
    ),
  );
  for (const action of plan.actions) {
    const text = describeAction(action);
    if (action.kind.startsWith("create")) lines.push(`  ${out.c.green("+")} ${text}`);
    else if (action.kind.startsWith("update")) lines.push(`  ${out.c.yellow("~")} ${text}`);
    else lines.push(`  ${out.c.red("-")} ${text}`);
  }
  for (const identity of plan.unchanged) {
    lines.push(`  ${out.c.dim("=")} ${out.c.dim(`${identity} (unchanged)`)}`);
  }
  return lines.join("\n");
}

function summarize(plan: Plan, extra: { dryRun: boolean; applied: number }): unknown {
  return {
    dryRun: extra.dryRun,
    applied: extra.applied,
    unchanged: plan.unchanged,
    actions: plan.actions.map(actionSummary),
  };
}

function actionSummary(action: PlanAction): Record<string, unknown> {
  switch (action.kind) {
    case "create-datasource":
      return { kind: action.kind, name: action.datasource.name };
    case "update-datasource":
      return { kind: action.kind, name: action.datasource.name, nodeId: action.nodeId, changes: action.changes };
    case "create-dataset":
      return { kind: action.kind, code: datasetCode(action.datasourceName, action.dataset) };
    case "update-dataset":
      return { kind: action.kind, code: action.code, nodeId: action.nodeId, changes: action.changes };
    case "delete-dataset":
      return { kind: action.kind, code: action.code, nodeId: action.nodeId };
  }
}
