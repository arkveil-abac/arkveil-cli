import { describe, it, expect } from "vitest";
import { renderPolicies } from "../src/commands/_render.js";
import { Output } from "../src/lib/output.js";
import type { OutputOptions } from "../src/lib/config.js";
import type { PolicyDTO } from "../src/lib/types.js";

function makeOutput(overrides: Partial<OutputOptions> = {}): Output {
  return new Output({
    json: false,
    quiet: false,
    verbose: false,
    color: false,
    isTty: false,
    ...overrides,
  });
}

const policy: PolicyDTO = {
  id: "11111111-2222-3333-4444-555555555555",
  targetId: "99999999-8888-7777-6666-555555555555",
  type: "RESULT",
  status: "ENABLED",
  title: "Own draft authoring",
  conditionDsl: "true",
  filterDsl: 'data.owner_id = user.id and data.status = "draft"',
  operations: ["CREATE", "UPDATE"],
  referencedDatasetCodes: ["demo_billing.public.invoice"],
};

describe("renderPolicies", () => {
  it("puts the policy id in the first column, which is what policies update/delete take", () => {
    const lines = renderPolicies(makeOutput(), [policy]).split("\n");

    expect(lines[0]?.startsWith("ID")).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines[2]?.startsWith(policy.id)).toBe(true);
    expect(lines[2]).toContain("RESULT");
    expect(lines[2]).toContain("CREATE,UPDATE");
    expect(lines[2]).toContain("Own draft authoring");
    expect(lines[2]).toContain("demo_billing.public.invoice");
  });

  it("shows a dash for a policy that governs no operations and binds no datasets", () => {
    const permission: PolicyDTO = {
      ...policy,
      type: "PERMISSION",
      title: "Editors may delete",
      operations: [],
      referencedDatasetCodes: [],
    };

    const row = renderPolicies(makeOutput(), [permission]).split("\n")[2] ?? "";

    expect(row.startsWith(permission.id)).toBe(true);
    expect(row).toContain("—");
  });

  it("renders an empty list as a note rather than a headerless table", () => {
    expect(renderPolicies(makeOutput(), [])).toBe("(no policies)");
  });
});
