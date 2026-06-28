/**
 * Command execution glue: builds a `CliContext` from the resolved global flags
 * for each command invocation, and centralizes error-to-exit-code mapping.
 */
import type { Command } from "commander";
import { createContext, type CliContext } from "./context.js";
import type { GlobalFlags } from "./config.js";
import { resolveOutputOptions } from "./config.js";
import { Output } from "./output.js";
import { ExitCode, isCliError, type ExitCodeValue } from "./errors.js";

/** Tracks the most recently constructed Output so the error handler can format. */
let activeOutput: Output | undefined;

/**
 * Wrap a command body: construct the context (config + output + client) from
 * the merged global flags and run it. Errors propagate to the global handler.
 */
export async function run(command: Command, fn: (ctx: CliContext) => Promise<void>): Promise<void> {
  const flags = command.optsWithGlobals() as GlobalFlags;
  const ctx = createContext(flags);
  activeOutput = ctx.out;
  await fn(ctx);
}

/** Map any thrown value to a friendly message and an exit code. */
export function handleError(err: unknown): ExitCodeValue {
  const out = activeOutput ?? new Output(resolveOutputOptions({}));

  if (isCliError(err)) {
    out.error(err.message, { hint: err.hint, exitCode: err.exitCode });
    if (err.cause instanceof Error && err.cause.stack) out.verbose(err.cause.stack);
    return err.exitCode;
  }

  const message = err instanceof Error ? err.message : String(err);
  out.error(`Unexpected error: ${message}`, {
    hint: "Re-run with --verbose for more detail.",
    exitCode: ExitCode.Generic,
  });
  if (err instanceof Error && err.stack) out.verbose(err.stack);
  return ExitCode.Generic;
}
