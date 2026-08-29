import type { CliContext } from "../../lib/context.js";
import { confirmAction } from "../_confirm.js";
import { postClear, postSeedDemo } from "./_api.js";

export interface ResetDemoOptions {
  yes?: boolean;
}

/**
 * DESTRUCTIVE: clear ALL workspace authorization data and seed the demo again.
 * The server endpoint is gone, so this is `clear` then `seed-demo` issued back
 * to back — which means the seed step spends the undo the clear just created.
 * Requires explicit confirmation.
 */
export async function resetDemo(ctx: CliContext, options: ResetDemoOptions): Promise<void> {
  await confirmAction(
    ctx,
    "This will PERMANENTLY DELETE every policy, target, action, test, and tag in the workspace, then reseed demo data. Continue?",
    options,
  );

  const client = await ctx.getClient({ requireAuth: true });
  const clearing = ctx.out.spinner("Clearing workspace…");
  try {
    await postClear(client);
    clearing.stop();
  } catch (err) {
    clearing.fail("Could not clear workspace.");
    throw err;
  }

  const seeding = ctx.out.spinner("Seeding demo data…");
  try {
    await postSeedDemo(client);
    seeding.stop();
  } catch (err) {
    seeding.fail("Could not seed demo data.");
    // Half-done resets are the one state worth naming out loud: the workspace
    // is empty and the caller has to choose which way to take it.
    ctx.out.warn(
      "The clear went through — the workspace is empty. Re-run `arkveil admin seed-demo`, or `arkveil admin undo-clear` to put back what the clear removed.",
    );
    throw err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "reset" });
  else ctx.out.success("Workspace cleared and demo data reseeded.");
}
