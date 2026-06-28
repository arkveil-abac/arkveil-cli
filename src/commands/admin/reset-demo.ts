import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { confirmAction } from "../_confirm.js";

export interface ResetDemoOptions {
  yes?: boolean;
}

/**
 * DESTRUCTIVE: wipe ALL workspace authorization data and reseed demo data
 * (POST .../reset-demo). Requires explicit confirmation.
 */
export async function resetDemo(ctx: CliContext, options: ResetDemoOptions): Promise<void> {
  await confirmAction(
    ctx,
    "This will PERMANENTLY DELETE every policy, target, action, test, and tag in the workspace, then reseed demo data. Continue?",
    options,
  );

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Resetting workspace to demo data…");
  try {
    await unwrap(client.POST("/api/v1/admin/workspaces/default/reset-demo"), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not reset workspace.");
    throw err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "reset" });
  else ctx.out.success("Workspace reset and demo data reseeded.");
}
