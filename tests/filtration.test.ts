import { describe, it, expect } from "vitest";
import { renderFiltration } from "../src/commands/_filtration.js";
import { renderRun } from "../src/commands/tests/_format.js";
import { Output } from "../src/lib/output.js";
import type { OutputOptions } from "../src/lib/config.js";
import type { FiltrationEvaluationDetails, TestRunDTO } from "../src/lib/types.js";

function out(overrides: Partial<OutputOptions> = {}): Output {
  return new Output({
    json: false,
    quiet: false,
    verbose: false,
    color: false,
    isTty: false,
    ...overrides,
  });
}

const applied = "a0f665f7-0000-0000-0000-000000000001";
const notApplied = "1c9de4a2-0000-0000-0000-000000000002";

function details(overrides: Partial<FiltrationEvaluationDetails> = {}): FiltrationEvaluationDetails {
  return {
    candidatePolicyIds: [applied, notApplied],
    targetEvaluations: [],
    policyEvaluations: [
      { policyId: applied, applicable: true },
      { policyId: notApplied, applicable: false },
    ],
    filterEvaluations: [{ policyId: applied, renderedFilter: `"t"."region" = 'eu'` }],
    ...overrides,
  };
}

describe("renderFiltration", () => {
  it("splits applying policies from target-matched ones that did not apply", () => {
    const lines = renderFiltration(out(), details());
    expect(lines).toEqual([
      "applied by",
      `  policy ${applied}  "t"."region" = 'eu'`,
      "not applied",
      `  policy ${notApplied}  (condition false)`,
    ]);
  });

  it("marks an applying policy that carries no filter", () => {
    const lines = renderFiltration(
      out(),
      details({ filterEvaluations: [] }),
    );
    expect(lines).toContain(`  policy ${applied}  (no filter)`);
  });

  it("surfaces a filter that failed to prepare", () => {
    const lines = renderFiltration(
      out(),
      details({ filterEvaluations: [{ policyId: applied, error: "unknown column" }] }),
    );
    expect(lines).toContain(`  policy ${applied}  (filter error: unknown column)`);
  });

  it("reports a condition that errored rather than merely being false", () => {
    const lines = renderFiltration(
      out(),
      details({
        policyEvaluations: [
          { policyId: notApplied, applicable: false, conditionTrace: { error: "bad attribute" } },
        ],
        filterEvaluations: [],
      }),
    );
    expect(lines).toEqual(["not applied", `  policy ${notApplied}  (condition error: bad attribute)`]);
  });

  it("renders nothing for a run stored before filter traces existed", () => {
    expect(renderFiltration(out(), undefined)).toEqual([]);
    expect(renderFiltration(out(), {})).toEqual([]);
  });

  it("indents every line when asked to", () => {
    const lines = renderFiltration(out(), details(), "  ");
    expect(lines.every((line) => line.startsWith("  "))).toBe(true);
  });
});

function datasetRun(passed: boolean): TestRunDTO {
  return {
    id: "run-1",
    testId: "test-1",
    triggeredAt: "2026-08-01T00:00:00Z",
    status: passed ? "PASSED" : "FAILED",
    summary: {
      totalCount: 1,
      passedCount: passed ? 1 : 0,
      failedCount: passed ? 0 : 1,
      errorCount: 0,
    },
    resolvedActionCodes: [],
    resolvedDatasetCodes: ["billing.public.invoice"],
    results: [
      {
        id: "res-1",
        runId: "run-1",
        datasetCode: "billing.public.invoice",
        passed,
        datasetOutcome: {
          expectedPks: ["1"],
          actualPks: passed ? ["1"] : ["1", "2"],
          renderedCondition: `"t"."region" = 'eu'`,
        },
        filtrationDetails: details(),
        evaluatedAt: "2026-08-01T00:00:00Z",
      },
    ],
  } as TestRunDTO;
}

describe("renderRun with dataset results", () => {
  it("expands a failing result with the pk diff and the policies behind the condition", () => {
    const rendered = renderRun(out(), datasetRun(false));
    expect(rendered).toContain("pk diff");
    expect(rendered).toContain("unexpected");
    expect(rendered).toMatch(/condition:\s+"t"\."region" = 'eu'/);
    expect(rendered).toContain(`  policy ${applied}`);
  });

  it("keeps a passing result to one row unless --verbose", () => {
    const rendered = renderRun(out(), datasetRun(true));
    expect(rendered).not.toContain("explain");
    expect(rendered).not.toContain(applied);
  });

  it("explains a passing result under --verbose", () => {
    const rendered = renderRun(out({ verbose: true }), datasetRun(true));
    expect(rendered).toContain("explain");
    expect(rendered).toMatch(/condition:\s+"t"\."region" = 'eu'/);
    expect(rendered).toContain(`  policy ${applied}  "t"."region" = 'eu'`);
    expect(rendered).not.toContain("pk diff");
  });
});
