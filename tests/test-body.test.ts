import { describe, it, expect } from "vitest";
import { buildTestBody, parseFixtures, canonicalPk } from "../src/commands/tests/_body.js";
import { collectImpact } from "../src/commands/datasets/impact.js";
import { UsageError } from "../src/lib/errors.js";
import type { CliContext } from "../src/lib/context.js";
import type { ResolvedNavigationTree } from "../src/lib/types.js";

/** Enough context for body building: it only ever emits warnings. */
function fakeContext(): { ctx: CliContext; warnings: string[] } {
  const warnings: string[] = [];
  const ctx = { out: { warn: (line: string) => warnings.push(line) } } as unknown as CliContext;
  return { ctx, warnings };
}

const base = { name: "t", status: "ENABLED" } as const;

describe("buildTestBody — action tests", () => {
  it("nests everything under a specification, with no flat fields left", async () => {
    const { ctx } = fakeContext();
    const body = await buildTestBody(ctx, {
      ...base,
      selectorType: "ACTION_SET",
      actionCode: ["articles:delete"],
      user: '{"role":"admin"}',
      expectedAccess: "GRANTED",
    });

    expect(body).toEqual({
      name: "t",
      tags: [],
      status: "ENABLED",
      specification: {
        type: "ACTION_ACCESS",
        selector: { type: "ACTION_SET", actionCodes: ["articles:delete"] },
        scenario: { userAttributes: { role: "admin" }, contextAttributes: {} },
        assertion: { expectedAccess: "GRANTED" },
      },
    });
    expect(body).not.toHaveProperty("selectorType");
    expect(body).not.toHaveProperty("userAttributes");
  });

  it("defaults the selector to ALL_ACTIONS", async () => {
    const { ctx } = fakeContext();
    const body = await buildTestBody(ctx, { ...base, expectedAccess: "DENIED" });
    expect(body.specification).toMatchObject({ selector: { type: "ALL_ACTIONS" } });
  });

  it("carries request attributes, which only action scenarios have", async () => {
    const { ctx } = fakeContext();
    const body = await buildTestBody(ctx, {
      ...base,
      expectedAccess: "GRANTED",
      request: '{"invoiceId":"7"}',
    });
    expect(body.specification).toMatchObject({
      scenario: { requestAttributes: { invoiceId: "7" } },
    });
  });

  it("sends only formulaDsl for a FORMULA selector, and warns about its scope", async () => {
    const { ctx, warnings } = fakeContext();
    const body = await buildTestBody(ctx, {
      ...base,
      selectorType: "FORMULA",
      formula: 'action.name startsWith "delete"',
      expectedAccess: "GRANTED",
    });
    expect(body.specification).toMatchObject({
      selector: { type: "FORMULA", formulaDsl: 'action.name startsWith "delete"' },
    });
    expect(body.specification).not.toHaveProperty("selector.formulaAst");
    expect(warnings.some((w) => w.includes("every action"))).toBe(true);
  });

  it("requires an action code for an ACTION_SET selector", async () => {
    const { ctx } = fakeContext();
    await expect(
      buildTestBody(ctx, { ...base, selectorType: "ACTION_SET", expectedAccess: "GRANTED" }),
    ).rejects.toThrowError(UsageError);
  });

  it("rejects dataset flags on an action test rather than dropping them", async () => {
    const { ctx } = fakeContext();
    await expect(
      buildTestBody(ctx, {
        ...base,
        expectedAccess: "GRANTED",
        datasetCode: "billing.public.invoice",
      }),
    ).rejects.toThrowError(/--dataset-code does not apply to a ACTION_ACCESS test/);
  });
});

describe("buildTestBody — dataset tests", () => {
  it("builds a DATASET_READ specification with fixtures and expected pks", async () => {
    const { ctx } = fakeContext();
    const body = await buildTestBody(ctx, {
      ...base,
      type: "DATASET_READ",
      datasetCode: "billing.public.invoice",
      user: '{"region":"EU"}',
      fixtures: '[{"id":"1","region":"EU"},{"id":"2","region":"US"}]',
      expectedPk: ["1"],
    });

    expect(body.specification).toEqual({
      type: "DATASET_READ",
      datasetCode: "billing.public.invoice",
      scenario: {
        userAttributes: { region: "EU" },
        contextAttributes: {},
        datasetFixtures: {
          "billing.public.invoice": [
            { id: "1", region: "EU" },
            { id: "2", region: "US" },
          ],
        },
      },
      assertion: { expectedVisiblePks: ["1"] },
    });
  });

  it("uses expectedWritablePks for DATASET_WRITE", async () => {
    const { ctx } = fakeContext();
    const body = await buildTestBody(ctx, {
      ...base,
      type: "DATASET_WRITE",
      datasetCode: "billing.public.invoice",
      expectedPk: ["1"],
    });
    expect(body.specification).toMatchObject({ assertion: { expectedWritablePks: ["1"] } });
  });

  it("lowercases the dataset code the way the server canonicalizes it", async () => {
    const { ctx } = fakeContext();
    const body = await buildTestBody(ctx, {
      ...base,
      type: "DATASET_READ",
      datasetCode: "Billing.PUBLIC.Invoice",
    });
    expect(body.specification).toMatchObject({ datasetCode: "billing.public.invoice" });
  });

  it("rejects --request: data policies cannot read request.*", async () => {
    const { ctx } = fakeContext();
    await expect(
      buildTestBody(ctx, {
        ...base,
        type: "DATASET_READ",
        datasetCode: "billing.public.invoice",
        request: "{}",
      }),
    ).rejects.toThrowError(/--request does not apply to a DATASET_READ test/);
  });

  it("requires a dataset code", async () => {
    const { ctx } = fakeContext();
    await expect(buildTestBody(ctx, { ...base, type: "DATASET_READ" })).rejects.toThrowError(
      UsageError,
    );
  });

  it("warns when the dataset code is not a full three-segment code", async () => {
    const { ctx, warnings } = fakeContext();
    await buildTestBody(ctx, { ...base, type: "DATASET_READ", datasetCode: "invoice" });
    expect(warnings.some((w) => w.includes("exactly 3 segments"))).toBe(true);
  });
});

describe("buildTestBody — --spec passthrough", () => {
  it("accepts a whole specification object", async () => {
    const { ctx } = fakeContext();
    const spec = { type: "DATASET_WRITE", datasetCode: "a.b.c" };
    const body = await buildTestBody(ctx, { ...base, spec: JSON.stringify(spec) });
    expect(body.specification).toEqual(spec);
  });

  it("rejects a specification whose type is not a wire value", async () => {
    const { ctx } = fakeContext();
    await expect(
      // The schema-generated name, not the discriminator the API accepts.
      buildTestBody(ctx, { ...base, spec: '{"type":"ActionAccessTestSpecification"}' }),
    ).rejects.toThrowError(/ACTION_ACCESS, DATASET_READ, or DATASET_WRITE/);
  });
});

describe("parseFixtures", () => {
  const code = "billing.public.invoice";

  it("treats an omitted fixture as an empty table, not as 'unset'", () => {
    expect(parseFixtures(undefined, code)).toEqual({ [code]: [] });
  });

  it("keys a bare row array by the tested dataset", () => {
    expect(parseFixtures('[{"id":"1"}]', code)).toEqual({ [code]: [{ id: "1" }] });
  });

  it("accepts the full map form, matching the key case-insensitively", () => {
    expect(parseFixtures('{"Billing.Public.Invoice":[{"id":"1"}]}', code)).toEqual({
      [code]: [{ id: "1" }],
    });
  });

  it("refuses fixtures for other datasets", () => {
    expect(() => parseFixtures('{"other.public.t":[]}', code)).toThrowError(
      /rows for other datasets/,
    );
  });

  it("reports malformed JSON as a usage error", () => {
    expect(() => parseFixtures("[{", code)).toThrowError(UsageError);
  });
});

describe("canonicalPk", () => {
  it("normalizes LONG values the way the server stores them", () => {
    expect(canonicalPk("042")).toBe("42");
    expect(canonicalPk(" 7 ")).toBe("7");
  });

  it("lowercases UUIDs", () => {
    expect(canonicalPk("A3F1B2C4-0000-0000-0000-000000000001")).toBe(
      "a3f1b2c4-0000-0000-0000-000000000001",
    );
  });
});

describe("collectImpact", () => {
  function tree(targets: unknown[]): ResolvedNavigationTree {
    return {
      dagType: "ACTION_POLICIES",
      root: {
        id: "root",
        title: "root",
        type: "FOLDER",
        root: true,
        children: targets,
      },
    } as unknown as ResolvedNavigationTree;
  }

  const boundTarget = {
    id: "node-1",
    title: "Invoices",
    type: "RESOURCE",
    resourceType: "TARGET",
    resource: {
      id: "t1",
      type: "DATA",
      mode: "INDIVIDUAL",
      title: "Invoices",
      datasetCode: "billing.public.invoice",
      policies: [],
    },
    children: [],
  };

  const referencingTarget = {
    id: "node-2",
    title: "Approve",
    type: "RESOURCE",
    resourceType: "TARGET",
    resource: {
      id: "t2",
      type: "ACTION",
      mode: "INDIVIDUAL",
      title: "Approve",
      policies: [
        {
          id: "p1",
          targetId: "t2",
          type: "PERMISSION",
          status: "ENABLED",
          title: "Invoice owner approval",
          conditionDsl: "exists invoice where data.id = request.invoiceId",
          referencedDatasetCodes: ["billing.public.invoice"],
        },
      ],
    },
    children: [],
  };

  it("finds both kinds of blocker across the policy DAGs", () => {
    const impact = collectImpact("billing.public.invoice", [
      tree([referencingTarget]),
      tree([boundTarget]),
    ]);
    expect(impact.boundTargets).toHaveLength(1);
    expect(impact.referencingPolicies).toHaveLength(1);
    expect(impact.referencingPolicies[0]?.policy?.id).toBe("p1");
  });

  it("matches referenced codes exactly — no substring over-match", () => {
    // `…invoices` must not block deletion of `…invoice`.
    const impact = collectImpact("billing.public.invoice", [
      tree([
        {
          ...referencingTarget,
          resource: {
            ...referencingTarget.resource,
            policies: [
              {
                ...referencingTarget.resource.policies[0],
                referencedDatasetCodes: ["billing.public.invoices"],
              },
            ],
          },
        },
      ]),
    ]);
    expect(impact.referencingPolicies).toEqual([]);
  });

  it("reports a free dataset as unreferenced", () => {
    const impact = collectImpact("billing.public.orders", [tree([boundTarget])]);
    expect(impact.boundTargets).toEqual([]);
    expect(impact.referencingPolicies).toEqual([]);
  });
});
