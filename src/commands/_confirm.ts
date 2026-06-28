/**
 * Interactive confirmation for destructive actions, backed by @clack/prompts.
 * In non-interactive contexts (piped, --json, no TTY) we refuse unless the user
 * passed --yes, so scripts never hang waiting on a prompt.
 */
import { confirm, isCancel } from "@clack/prompts";
import type { CliContext } from "../lib/context.js";
import { CancelledError, UsageError } from "../lib/errors.js";

export async function confirmAction(
  ctx: CliContext,
  message: string,
  options: { yes?: boolean },
): Promise<void> {
  if (options.yes) return;

  if (!ctx.out.opts.isTty || ctx.out.opts.json) {
    throw new UsageError(
      "Refusing to perform a destructive action without confirmation.",
      "Re-run with --yes to confirm non-interactively.",
    );
  }

  const answer = await confirm({ message });
  if (isCancel(answer) || answer !== true) {
    throw new CancelledError("Aborted by user.");
  }
}
