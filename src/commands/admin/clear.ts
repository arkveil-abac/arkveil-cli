import type { CliContext } from "../../lib/context.js";
import { confirmAction } from "../_confirm.js";
import { postClear } from "./_api.js";

export interface ClearOptions {
  yes?: boolean;
}

/**
 * DESTRUCTIVE: hard-delete ALL workspace authorization data and leave the
 * workspace empty (POST .../clear). Recoverable with `admin undo-clear` for as
 * long as the workspace stays empty. Requires explicit confirmation.
 */
export async function clearWorkspace(ctx: CliContext, options: ClearOptions): Promise<void> {
  await confirmAction(
    ctx,
    "This will PERMANENTLY DELETE every policy, target, dataset, datasource, action, test, and tag in the workspace, leaving it empty. Continue?",
    options,
  );

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Clearing workspace…");
  try {
    await postClear(client);
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not clear workspace.");
    throw err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "cleared" });
  else
    ctx.out.success(
      "Workspace cleared. It is now empty — `arkveil admin undo-clear` puts it back while it stays that way, `arkveil admin seed-demo` seeds the demo instead.",
    );
}
