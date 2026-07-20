/**
 * Shared human-readable renderers for navigation trees and policy/resource
 * summaries. JSON output never uses these — it prints the raw API payload.
 */
import type { Output } from "../lib/output.js";
import type {
  ResolvedNavigationTree,
  ResolvedNavigationNode,
  PolicyDTO,
} from "../lib/types.js";

/** The spec types `children` as unknown[]; at runtime they are nested nodes. */
type NodeLike = Partial<ResolvedNavigationNode> & { children?: unknown[] };

export function renderTree(out: Output, tree: ResolvedNavigationTree): string {
  const lines: string[] = [out.c.bold(out.c.cyan(tree.dagType))];
  renderNode(out, tree.root as NodeLike, "", lines);
  return lines.join("\n");
}

export function renderForest(out: Output, trees: ResolvedNavigationTree[]): string {
  if (trees.length === 0) return out.c.dim("(no navigation trees)");
  return trees.map((t) => renderTree(out, t)).join("\n\n");
}

function renderNode(out: Output, node: NodeLike, prefix: string, lines: string[]): void {
  const children = Array.isArray(node.children) ? (node.children as NodeLike[]) : [];
  children.forEach((child, index) => {
    const last = index === children.length - 1;
    const branch = last ? "└─ " : "├─ ";
    lines.push(`${prefix}${out.c.dim(branch)}${formatNodeLabel(out, child)}`);
    renderNode(out, child, prefix + (last ? "   " : out.c.dim("│  ")), lines);
  });
}

function formatNodeLabel(out: Output, node: NodeLike): string {
  const isFolder = node.type === "FOLDER";
  const icon = isFolder ? "📁" : "•";
  const title = node.title ?? "(untitled)";
  const kind = node.resourceType ? out.c.dim(` [${node.resourceType}]`) : "";
  const id = node.id ? out.c.dim(` ${node.id}`) : "";
  return `${icon} ${isFolder ? out.c.bold(title) : title}${kind}${id}`;
}

/**
 * `referencedDatasetCodes` is the canonical set of datasets a policy's
 * condition binds, whatever the spelling in `conditionDsl` — it is what makes
 * delete ordering computable, so it earns a column.
 */
export function renderPolicies(out: Output, policies: PolicyDTO[]): string {
  if (policies.length === 0) return out.c.dim("(no policies)");
  return out.table(
    ["ID", "TYPE", "STATUS", "TITLE", "DATASETS"],
    policies.map((p) => [
      p.id,
      p.type,
      p.status,
      p.title,
      (p.referencedDatasetCodes ?? []).join(", ") || out.c.dim("—"),
    ]),
  );
}
