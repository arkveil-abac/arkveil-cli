import { describe, it, expect } from "vitest";
import {
  lintFormula,
  lintDatasetReference,
  lintDatasetCode,
  lintIdentitySegment,
  FORMULA_KEYWORDS,
} from "../src/lib/formula-lint.js";

describe("lintFormula — the entity.* rename", () => {
  it("flags the removed namespace and names the replacement", () => {
    const [warning, ...rest] = lintFormula("entity.author_id = user.id", "--filter");
    expect(rest).toHaveLength(0);
    expect(warning).toContain("entity.author_id");
    expect(warning).toContain("data.author_id");
  });

  it("flags every occurrence, not just the first", () => {
    const [warning] = lintFormula("entity.a = user.id and entity.b = 1", "--filter");
    expect(warning).toContain("entity.a");
    expect(warning).toContain("entity.b");
  });

  it("says nothing about a formula already using data.*", () => {
    expect(lintFormula("data.author_id = user.id", "--filter")).toEqual([]);
  });

  it("does not fire on an attribute merely containing 'entity'", () => {
    expect(lintFormula('user.entityType = "org"', "--condition")).toEqual([]);
  });
});

describe("lintFormula — numeric literals and operators", () => {
  it("accepts the ordering operators with decimal and negative scalars", () => {
    expect(lintFormula("data.amount > 99.95 and data.delta >= -0.5", "--filter")).toEqual([]);
    expect(lintFormula("user.age <= 65 and request.total < -5", "--condition")).toEqual([]);
  });

  it("flags a decimal missing digits on either side of the dot", () => {
    expect(lintFormula("data.amount > .5", "--filter")[0]).toContain("digits on one side");
    expect(lintFormula("data.amount > 1.", "--filter")[0]).toContain("digits on one side");
  });

  it("flags signed or decimal array elements, which stay unsupported", () => {
    expect(lintFormula("user.n in [-1, 2]", "--condition")[0]).toContain("array literal");
    expect(lintFormula("user.n in [1.5]", "--condition")[0]).toContain("array literal");
  });

  it("leaves a legal array literal alone", () => {
    expect(lintFormula('user.role in ["admin","editor"]', "--condition")).toEqual([]);
    expect(lintFormula("user.n in [1,2,3]", "--condition")).toEqual([]);
  });

  it("does not mistake a dotted attribute path for a malformed number", () => {
    expect(lintFormula("request.invoice.line.total = 1", "--condition")).toEqual([]);
  });
});

describe("lintFormula — dataset references in an exists body", () => {
  it("says nothing about a full, lowercase code", () => {
    expect(
      lintFormula("exists billing.public.invoice where data.id = request.invoiceId", "--condition"),
    ).toEqual([]);
  });

  it("warns that a short reference resolves against live workspace state", () => {
    const warnings = lintFormula("exists invoice where data.id = request.invoiceId", "--condition");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("short dataset reference");
  });

  it("flags a case-variant reference, which the server does not normalize", () => {
    const warnings = lintFormula(
      "exists Billing.public.Invoice where data.id = request.invoiceId",
      "--condition",
    );
    expect(warnings.some((w) => w.includes("canonical lowercase"))).toBe(true);
  });

  it("flags the two-segment form, which is neither a table nor a code", () => {
    const warnings = lintFormula("exists public.invoice where data.id = 1", "--condition");
    expect(warnings.some((w) => w.includes("two segments"))).toBe(true);
  });

  it("leaves an iterative `exists` over an attribute array alone", () => {
    expect(lintFormula('exists user.tags where it = "vip"', "--condition")).toEqual([]);
    expect(lintFormula("exists request.items where it != 0", "--condition")).toEqual([]);
  });
});

describe("lintDatasetReference", () => {
  it("flags more than three segments", () => {
    const warnings = lintDatasetReference("a.b.c.d", "--condition");
    expect(warnings.some((w) => w.includes("4 segments"))).toBe(true);
  });
});

describe("lintDatasetCode", () => {
  it("accepts exactly three non-empty segments", () => {
    expect(lintDatasetCode("billing.public.invoice", "--dataset-code")).toEqual([]);
  });

  it("rejects anything else, including the short form", () => {
    expect(lintDatasetCode("invoice", "--dataset-code")[0]).toContain("exactly 3 segments");
    expect(lintDatasetCode("public.invoice", "--dataset-code")[0]).toContain("exactly 3 segments");
    expect(lintDatasetCode("billing..invoice", "--dataset-code")[0]).toContain("exactly 3 segments");
  });
});

describe("lintIdentitySegment", () => {
  it("rejects `data`, which became reserved with the namespace rename", () => {
    expect(lintIdentitySegment("data", "Schema")[0]).toContain("Formula DSL keyword");
  });

  it("no longer rejects `entity`, which was freed by the same rename", () => {
    expect(lintIdentitySegment("entity", "Schema")).toEqual([]);
    expect(FORMULA_KEYWORDS.has("entity")).toBe(false);
  });

  it("rejects keywords case-insensitively", () => {
    expect(lintIdentitySegment("WHERE", "Table name")).toHaveLength(1);
  });

  it("leaves an ordinary segment alone", () => {
    expect(lintIdentitySegment("invoice", "Table name")).toEqual([]);
  });
});
