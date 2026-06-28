import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";

/** Reseed demo data, preserving existing entities (POST .../seed-demo). */
export async function seedDemo(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Seeding demo data…");
  try {
    await unwrap(client.POST("/api/v1/admin/workspaces/default/seed-demo"), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not seed demo data.");
    throw err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "seeded" });
  else ctx.out.success("Demo data seeded (existing entities preserved).");
}
