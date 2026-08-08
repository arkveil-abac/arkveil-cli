import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { confirmAction } from "../_confirm.js";

export interface WipeOptions {
  yes?: boolean;
}

/**
 * DESTRUCTIVE: hard-delete ALL workspace authorization data and leave the
 * workspace empty (POST .../wipe) — unlike `reset-demo`, nothing is reseeded
 * and the workspace will not auto-seed on the next sign-in. Requires explicit
 * confirmation.
 */
export async function wipeWorkspace(ctx: CliContext, options: WipeOptions): Promise<void> {
  await confirmAction(
    ctx,
    "This will PERMANENTLY DELETE every policy, target, dataset, datasource, action, test, and tag in the workspace, leaving it empty. Continue?",
    options,
  );

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Wiping workspace…");
  try {
    await unwrap(client.POST("/api/v1/admin/workspaces/default/wipe"), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not wipe workspace.");
    throw err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "wiped" });
  else ctx.out.success("Workspace wiped. It is now empty — run `arkveil admin seed-demo` to reseed.");
}
