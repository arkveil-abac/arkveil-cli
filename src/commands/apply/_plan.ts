/**
 * Pure planning for `arkveil apply`: diff a normalized manifest against the
 * server's datasources tree and produce the ordered list of API calls needed
 * to reach the desired state. No I/O here — the executor lives in apply.ts.
 *
 * Rules from the management API:
 * - Duplicates are plain 400s, not upserts, so create vs. update vs. no-op is
 *   decided here from the tree, never by retrying.
 * - Identity is immutable (datasource name, dataset dbSchema/tableName); a
 *   changed identity shows up as a create of the new identity plus, with
 *   --prune, a delete of the old one.
 * - Creation order is datasource → dataset; prune deletes run last, and only
 *   datasets are pruned (targets keep protecting them with clean 400s).
 */
import type { ResolvedNavigationTree, DatasourceDTO, DatasetDTO } from "../../lib/types.js";
import {
  findDatasourceNode,
  datasetNodesUnder,
  canonical,
  type TreeNode,
} from "../_resolve.js";
import { datasetCode, type Manifest, type ManifestDataset, type ManifestDatasource } from "./_manifest.js";

export type PlanAction =
  | { kind: "create-datasource"; datasource: ManifestDatasource }
  | { kind: "update-datasource"; nodeId: string; datasource: ManifestDatasource; changes: string[] }
  | {
      kind: "create-dataset";
      datasourceName: string;
      /** Known when the datasource already exists; resolved after its create otherwise. */
      datasourceNodeId?: string;
      dataset: ManifestDataset;
    }
  | { kind: "update-dataset"; nodeId: string; code: string; dataset: ManifestDataset; changes: string[] }
  | { kind: "delete-dataset"; nodeId: string; code: string };

export interface Plan {
  actions: PlanAction[];
  /** Canonical identities already in the desired state. */
  unchanged: string[];
}

export interface PlanOptions {
  /** Delete server datasets not declared in the manifest, scoped to manifest-declared datasources. */
  prune: boolean;
}

export function planApply(manifest: Manifest, tree: ResolvedNavigationTree, options: PlanOptions): Plan {
  const mutations: PlanAction[] = [];
  const deletions: PlanAction[] = [];
  const unchanged: string[] = [];

  for (const desired of manifest.datasources) {
    const node = findDatasourceNode(tree, desired.name);

    if (!node?.id || !node.resource) {
      mutations.push({ kind: "create-datasource", datasource: desired });
      for (const dataset of desired.datasets) {
        mutations.push({ kind: "create-dataset", datasourceName: desired.name, dataset });
      }
      continue;
    }

    const actual = node.resource as DatasourceDTO;
    const changes = diffDatasource(desired, actual);
    if (changes.length > 0) {
      // Carry the server's description forward when the manifest omits it, so
      // a dialect-only update never clears it.
      const datasource = {
        ...desired,
        ...(desired.description === undefined && actual.description !== undefined
          ? { description: actual.description }
          : {}),
      };
      mutations.push({ kind: "update-datasource", nodeId: node.id, datasource, changes });
    } else {
      unchanged.push(`datasource ${desired.name}`);
    }

    planDatasets(desired, node, options, mutations, deletions, unchanged);
  }

  return { actions: [...mutations, ...deletions], unchanged };
}

function planDatasets(
  desired: ManifestDatasource,
  datasourceNode: TreeNode,
  options: PlanOptions,
  mutations: PlanAction[],
  deletions: PlanAction[],
  unchanged: string[],
): void {
  const actualNodes = datasetNodesUnder(datasourceNode);
  const matched = new Set<TreeNode>();

  for (const dataset of desired.datasets) {
    const code = datasetCode(desired.name, dataset);
    const node = actualNodes.find(
      (n) => canonical((n.resource as DatasetDTO).code ?? "") === code,
    );

    if (!node?.id || !node.resource) {
      mutations.push({
        kind: "create-dataset",
        datasourceName: desired.name,
        datasourceNodeId: datasourceNode.id,
        dataset,
      });
      continue;
    }

    matched.add(node);
    const actual = node.resource as DatasetDTO;
    const changes = diffDataset(dataset, actual);
    if (changes.length > 0) {
      const effective = {
        ...dataset,
        ...(dataset.description === undefined && actual.description !== undefined
          ? { description: actual.description }
          : {}),
      };
      mutations.push({ kind: "update-dataset", nodeId: node.id, code, dataset: effective, changes });
    } else {
      unchanged.push(`dataset ${code}`);
    }
  }

  if (options.prune) {
    for (const node of actualNodes) {
      if (matched.has(node) || !node.id) continue;
      deletions.push({
        kind: "delete-dataset",
        nodeId: node.id,
        code: (node.resource as DatasetDTO).code,
      });
    }
  }
}

/** Mutable datasource fields: dialect and description. A description omitted
 * from the manifest is left alone rather than treated as a clear. */
function diffDatasource(desired: ManifestDatasource, actual: DatasourceDTO): string[] {
  const changes: string[] = [];
  if (desired.dialect !== actual.dialect) changes.push("dialect");
  if (desired.description !== undefined && desired.description !== (actual.description ?? "")) {
    changes.push("description");
  }
  return changes;
}

/** Mutable dataset fields. `entitySchema` is always part of the desired state
 * (a manifest entry without one means an empty schema), so it always diffs. */
function diffDataset(desired: ManifestDataset, actual: DatasetDTO): string[] {
  const changes: string[] = [];
  if (desired.title !== actual.title) changes.push("title");
  if (desired.pkName !== actual.pkName) changes.push("pkName");
  if (desired.pkType !== actual.pkType) changes.push("pkType");
  if (desired.description !== undefined && desired.description !== (actual.description ?? "")) {
    changes.push("description");
  }
  if (!deepEqual(desired.entitySchema, actual.entitySchema ?? {})) changes.push("entitySchema");
  return changes;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

/** One-line human description of a plan action, used by --dry-run and progress. */
export function describeAction(action: PlanAction): string {
  switch (action.kind) {
    case "create-datasource":
      return `create datasource ${action.datasource.name} (${action.datasource.dialect})`;
    case "update-datasource":
      return `update datasource ${action.datasource.name} (${action.changes.join(", ")})`;
    case "create-dataset":
      return `create dataset ${datasetCode(action.datasourceName, action.dataset)}`;
    case "update-dataset":
      return `update dataset ${action.code} (${action.changes.join(", ")})`;
    case "delete-dataset":
      return `delete dataset ${action.code}`;
  }
}
