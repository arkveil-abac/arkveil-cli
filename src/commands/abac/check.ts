import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { PermissionCheckRequest, PermissionCheckResponse } from "../../lib/types.js";

export interface CheckOptions {
  actionCode: string;
  user?: string;
  context?: string;
  request?: string;
}

/**
 * Explanations for the `reason` values that are not policy denials. A
 * dataset-backed permission rule cannot be decided by the kernel at all — it
 * needs a runtime with the datasource connected — so `granted: false` there is
 * the expected answer, not a failing check.
 */
const REASON_NOTES: Record<string, string> = {
  RUNTIME_REQUIRED:
    "RUNTIME_REQUIRED — a rule reads a dataset, which only a connected runtime (sidecar) can " +
    "evaluate. Ask a sidecar base URL for the real decision; this is not a denial.",
  DATASOURCE_UNRESOLVED:
    "DATASOURCE_UNRESOLVED — the runtime has no connection for the referenced datasource. Check " +
    "`arkveil.runtime.datasources.<name>.*` on the sidecar, or wait for the mirror to replicate it.",
};

/** Check a single permission (POST /abac/permissions/check). */
export async function checkPermission(ctx: CliContext, options: CheckOptions): Promise<void> {
  const body: PermissionCheckRequest = {
    actionCode: options.actionCode,
    user: parseJsonObjectFlag(options.user, "--user") ?? {},
    context: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.request !== undefined
      ? { request: parseJsonObjectFlag(options.request, "--request") ?? {} }
      : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Checking permission ${options.actionCode}…`);
  let result: PermissionCheckResponse;
  try {
    result = await unwrap(client.POST("/api/v1/abac/permissions/check", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Permission check failed.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const rows: [string, string][] = [
      ["action code", options.actionCode],
      ["granted", result.granted ? o.c.green("true") : o.c.red("false")],
    ];
    if (result.reason) rows.push(["reason", result.reason]);
    const note = result.reason ? REASON_NOTES[result.reason] : undefined;
    return note ? `${o.keyValue(rows)}\n${o.c.yellow(note)}` : o.keyValue(rows);
  });
}
