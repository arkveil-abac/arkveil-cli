import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { lintDatasetCode } from "../../lib/formula-lint.js";
import { warnOnFormulas } from "../_lint.js";
import { canonical } from "../_resolve.js";
import { renderTree } from "../_render.js";
import type {
  CreateTargetRequest,
  ResolvedNavigationTree,
  TargetType,
  TargetMode,
} from "../../lib/types.js";

export interface CreateTargetOptions {
  parent: string;
  type: TargetType;
  mode: TargetMode;
  title: string;
  description?: string;
  actionCode?: string;
  datasetCode?: string;
  condition?: string;
  requestSchema?: string;
}

/** Create a navigation target (POST /navigation/targets). */
export async function createTarget(ctx: CliContext, options: CreateTargetOptions): Promise<void> {
  const requestSchema =
    options.requestSchema !== undefined
      ? asObject(await readJsonInput(options.requestSchema, "--request-schema"), "--request-schema")
      : undefined;

  warnOnFormulas(ctx, [["--condition", options.condition]]);
  // The server lowercases a target's datasetCode, so canonicalize locally too
  // and keep the echoed tree comparable with what was sent.
  const datasetCode = options.datasetCode !== undefined ? canonical(options.datasetCode) : undefined;
  if (datasetCode !== undefined) {
    for (const warning of lintDatasetCode(datasetCode, "--dataset-code")) ctx.out.warn(warning);
  }

  const body: CreateTargetRequest = {
    parentFolderId: options.parent,
    type: options.type,
    mode: options.mode,
    title: options.title,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.actionCode !== undefined ? { actionCode: options.actionCode } : {}),
    ...(datasetCode !== undefined ? { datasetCode } : {}),
    ...(options.condition !== undefined ? { conditionDsl: options.condition } : {}),
    ...(requestSchema !== undefined ? { requestSchema } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating target…");
  let tree: ResolvedNavigationTree;
  try {
    tree = await unwrap(client.POST("/api/v1/navigation/targets", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create target.");
    throw err;
  }
  ctx.out.success(`Created ${options.type} target "${options.title}".`);
  ctx.out.data(tree, (o) => renderTree(o, tree));
}
