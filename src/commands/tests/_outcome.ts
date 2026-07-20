/**
 * Turn run statuses into process exit codes, so `tests run` / `tests run-all`
 * are usable as CI gates. Status precedence within and across runs is
 * ERROR > FAILED > PASSED; `INVALID` exists in the enum but is never emitted.
 */
import { CliError, ExitCode } from "../../lib/errors.js";
import type { TestRunDTO } from "../../lib/types.js";

/** Throw the exit-code-carrying error matching the worst status in `runs`. */
export function failOnRunOutcome(runs: TestRunDTO[]): void {
  const errored = runs.filter((run) => run.status === "ERROR");
  if (errored.length > 0) {
    throw new CliError(
      `${errored.length} test run(s) could not run (ERROR).`,
      {
        exitCode: ExitCode.TestError,
        hint:
          "An ERROR means the test never evaluated — a missing action, a deleted dataset, or a " +
          "fixture that no longer matches the dataset schema. Re-save the test to refresh it.",
      },
    );
  }

  const failed = runs.filter((run) => run.status === "FAILED");
  if (failed.length > 0) {
    throw new CliError(`${failed.length} test run(s) failed.`, {
      exitCode: ExitCode.TestFailed,
      hint: "Inspect a run with `arkveil tests run-info <runId>` to see the per-subject diff.",
    });
  }
}
