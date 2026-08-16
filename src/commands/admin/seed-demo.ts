import type { CliContext } from "../../lib/context.js";
import { ApiError, CliError, ExitCode } from "../../lib/errors.js";
import { postSeedDemo } from "./_api.js";

/**
 * Create the canonical demo workspace (POST .../seed-demo). Create-only: it
 * needs an empty workspace and answers 400 if anything is live, so this is not
 * something to re-run for idempotence.
 */
export async function seedDemo(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Seeding demo data…");
  try {
    await postSeedDemo(client);
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not seed demo data.");
    throw notEmpty(err) ?? err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "seeded" });
  else ctx.out.success("Demo data seeded. `arkveil tests run-all` should report every test passing.");
}

/**
 * The one documented 400: the workspace already holds something. Replace the
 * generic "review the flags" hint — this command takes neither flags nor a
 * payload, and clearing first is the only way forward.
 */
function notEmpty(err: unknown): CliError | undefined {
  if (!(err instanceof ApiError) || err.status !== 400) return undefined;
  if (!/empty workspace/i.test(err.serverMessage ?? "")) return undefined;
  return new CliError(err.serverMessage ?? "The workspace is not empty.", {
    exitCode: ExitCode.Api,
    hint: "Run `arkveil admin clear` first, or `arkveil admin reset-demo` to do both in one step.",
    cause: err,
  });
}
