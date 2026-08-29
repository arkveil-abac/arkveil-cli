import type { CliContext } from "../../lib/context.js";
import { ApiError, CliError, ExitCode } from "../../lib/errors.js";
import { postUndoClear } from "./_api.js";

/**
 * Restore the last `clear` (POST .../undo-clear): every entity comes back under
 * its original id and the trees in their previous shape. Not destructive, so no
 * confirmation — but it only works while the workspace is still empty.
 */
export async function undoClear(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Restoring the last clear…");
  try {
    await postUndoClear(client);
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not undo the clear.");
    throw windowClosed(err) ?? err;
  }
  if (ctx.out.opts.json) ctx.out.json({ status: "restored" });
  else
    ctx.out.success(
      "Last clear undone. Entities are back under their original ids; test runs and results are not restored.",
    );
}

/**
 * A 400 means the undo window has closed — either there is nothing to undo, or
 * the workspace is no longer empty. The server message names which. Nothing in
 * the request can be fixed and a retry cannot succeed, so surface the message
 * without the generic "review the flags" hint that a 400 usually carries.
 */
function windowClosed(err: unknown): CliError | undefined {
  if (!(err instanceof ApiError) || err.status !== 400) return undefined;
  return new CliError(err.serverMessage ?? "The undo window has closed.", {
    exitCode: ExitCode.Api,
    cause: err,
  });
}
