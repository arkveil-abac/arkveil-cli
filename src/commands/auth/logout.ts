import type { CliContext } from "../../lib/context.js";
import { clearStoredCredentials } from "../../lib/auth.js";

/** Remove stored credentials from the local file and the OS keychain. */
export async function logout(ctx: CliContext): Promise<void> {
  const removed = await clearStoredCredentials(ctx.config, ctx.out);
  if (ctx.out.opts.json) {
    ctx.out.json({ status: removed ? "logged_out" : "not_authenticated" });
    return;
  }
  if (removed) ctx.out.success("Logged out. Stored credentials removed.");
  else ctx.out.info("No stored credentials to remove.");
}
