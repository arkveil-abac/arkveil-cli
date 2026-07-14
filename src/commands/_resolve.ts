/**
 * Resolver helpers over navigation-tree responses. Every management mutation
 * returns the full resolved tree of the affected DAG rather than the created
 * object, so commands locate nodes by `resourceType` plus a known resource
 * field. The **DAG node `id`** (not `resource.id`) is what update/delete URLs
 * take. Names and dataset segments are canonicalized (lowercased) server-side,
 * so lookups normalize before comparing.
 */
import type {
  ResolvedNavigationTree,
  ResolvedNavigationNode,
  DatasourceDTO,
  DatasetDTO,
} from "../lib/types.js";

/** The spec types `children` as unknown[]; at runtime they are nested nodes. */
export type TreeNode = Partial<ResolvedNavigationNode> & { children?: unknown[] };

/** Lowercase + trim, matching the server's canonicalization of identifiers. */
export function canonical(value: string): string {
  return value.trim().toLowerCase();
}

/** Depth-first walk over a node and its descendants. */
export function* walk(node: TreeNode): Generator<TreeNode> {
  yield node;
  const children = Array.isArray(node.children) ? (node.children as TreeNode[]) : [];
  for (const child of children) yield* walk(child);
}

/** Find the first RESOURCE node of a given type matching the predicate. */
export function findResourceNode(
  root: TreeNode,
  resourceType: NonNullable<ResolvedNavigationNode["resourceType"]>,
  predicate: (resource: unknown) => boolean,
): TreeNode | undefined {
  for (const node of walk(root)) {
    if (node.resourceType === resourceType && node.resource && predicate(node.resource)) {
      return node;
    }
  }
  return undefined;
}

/** Find a datasource node by canonical name in the datasources tree. */
export function findDatasourceNode(
  tree: ResolvedNavigationTree,
  name: string,
): TreeNode | undefined {
  const wanted = canonical(name);
  return findResourceNode(
    tree.root as TreeNode,
    "DATASOURCE",
    (r) => canonical((r as DatasourceDTO).name ?? "") === wanted,
  );
}

/** Find a dataset node by canonical code (`datasource.schema.table`). */
export function findDatasetNode(
  root: TreeNode,
  code: string,
): TreeNode | undefined {
  const wanted = canonical(code);
  return findResourceNode(
    root,
    "DATASET",
    (r) => canonical((r as DatasetDTO).code ?? "") === wanted,
  );
}

/** Find a node by its DAG node id anywhere in the tree. */
export function findNodeById(root: TreeNode, nodeId: string): TreeNode | undefined {
  for (const node of walk(root)) {
    if (node.id === nodeId) return node;
  }
  return undefined;
}

/** Dataset nodes nested under a datasource node (datasets have no folders). */
export function datasetNodesUnder(datasourceNode: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of walk(datasourceNode)) {
    if (node !== datasourceNode && node.resourceType === "DATASET" && node.resource) {
      result.push(node);
    }
  }
  return result;
}
