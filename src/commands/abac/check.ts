import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import type { PermissionCheckRequest, PermissionCheckResponse } from "../../lib/types.js";

export interface CheckOptions {
  code: string;
  user?: string;
  context?: string;
  request?: string;
}

/** Check a single permission (POST /abac/permissions/check). */
export async function checkPermission(ctx: CliContext, options: CheckOptions): Promise<void> {
  const body: PermissionCheckRequest = {
    code: options.code,
    user: parseJsonObjectFlag(options.user, "--user") ?? {},
    context: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.request !== undefined
      ? { request: parseJsonObjectFlag(options.request, "--request") ?? {} }
      : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Checking permission ${options.code}…`);
  let result: PermissionCheckResponse;
  try {
    result = await unwrap(client.POST("/api/v1/abac/permissions/check", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Permission check failed.");
    throw err;
  }

  ctx.out.data(result, (o) =>
    o.keyValue([
      ["code", options.code],
      ["granted", result.granted ? o.c.green("true") : o.c.red("false")],
    ]),
  );
}
