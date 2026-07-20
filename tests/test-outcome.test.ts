import { describe, it, expect } from "vitest";
import { failOnRunOutcome } from "../src/commands/tests/_outcome.js";
import { CliError, ExitCode } from "../src/lib/errors.js";
import type { TestRunDTO } from "../src/lib/types.js";

function run(status: TestRunDTO["status"]): TestRunDTO {
  return {
    id: `run-${status}`,
    testId: "t",
    status,
    summary: { totalCount: 1, passedCount: 0, failedCount: 0, errorCount: 0 },
    resolvedActionCodes: [],
    resolvedDatasetCodes: [],
  } as unknown as TestRunDTO;
}

describe("failOnRunOutcome", () => {
  it("is silent when everything passed", () => {
    expect(() => failOnRunOutcome([run("PASSED"), run("PASSED")])).not.toThrow();
  });

  it("is silent on an empty batch", () => {
    expect(() => failOnRunOutcome([])).not.toThrow();
  });

  it("exits 8 on an assertion mismatch", () => {
    try {
      failOnRunOutcome([run("PASSED"), run("FAILED")]);
      expect.unreachable("expected a failure");
    } catch (err) {
      expect((err as CliError).exitCode).toBe(ExitCode.TestFailed);
    }
  });

  it("exits 9 when a test could not run at all", () => {
    try {
      failOnRunOutcome([run("ERROR")]);
      expect.unreachable("expected a failure");
    } catch (err) {
      expect((err as CliError).exitCode).toBe(ExitCode.TestError);
    }
  });

  it("ranks ERROR above FAILED when a batch has both", () => {
    try {
      failOnRunOutcome([run("FAILED"), run("ERROR")]);
      expect.unreachable("expected a failure");
    } catch (err) {
      expect((err as CliError).exitCode).toBe(ExitCode.TestError);
    }
  });
});
