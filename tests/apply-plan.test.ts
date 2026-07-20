import { describe, it, expect } from "vitest";
import { parseManifest, datasetCode } from "../src/commands/apply/_manifest.js";
import { planApply, describeAction } from "../src/commands/apply/_plan.js";
import { UsageError } from "../src/lib/errors.js";
import { datasourcesTree } from "./resolve.test.js";

const invoices = {
  dbSchema: "public",
  tableName: "invoices",
  title: "Invoices",
  pkName: "id",
  pkType: "UUID",
  dataSchema: { type: "object", properties: { amount: { type: "number" } } },
};

const orders = {
  dbSchema: "public",
  tableName: "orders",
  title: "Orders",
  pkName: "id",
  pkType: "LONG",
};

/** Mirrors the fixture tree exactly, so a plan against it is a full no-op. */
function upToDateManifest(): unknown {
  return {
    datasources: [
      { name: "billing", dialect: "POSTGRES", datasets: [invoices, orders] },
      { name: "crm", dialect: "MYSQL", datasets: [] },
    ],
  };
}

describe("parseManifest", () => {
  it("normalizes identity segments to canonical (lowercase) form", () => {
    const manifest = parseManifest({
      datasources: [
        { name: " Billing ", dialect: "POSTGRES", datasets: [{ ...invoices, dbSchema: "PUBLIC", tableName: "Invoices" }] },
      ],
    });
    const ds = manifest.datasources[0]!;
    expect(ds.name).toBe("billing");
    expect(ds.datasets[0]!.dbSchema).toBe("public");
    expect(datasetCode(ds.name, ds.datasets[0]!)).toBe("billing.public.invoices");
  });

  it("defaults a missing dataSchema to the empty (cleared) schema", () => {
    const manifest = parseManifest({
      datasources: [{ name: "billing", dialect: "POSTGRES", datasets: [orders] }],
    });
    expect(manifest.datasources[0]!.datasets[0]!.dataSchema).toEqual({});
  });

  it("rejects identifiers that violate the server charset", () => {
    expect(() =>
      parseManifest({ datasources: [{ name: "9billing", dialect: "POSTGRES" }] }),
    ).toThrowError(UsageError);
    expect(() =>
      parseManifest({
        datasources: [
          { name: "billing", dialect: "POSTGRES", datasets: [{ ...orders, tableName: "bad-name" }] },
        ],
      }),
    ).toThrowError(/must match/);
  });

  it("rejects case-insensitive duplicate identities", () => {
    expect(() =>
      parseManifest({
        datasources: [
          { name: "billing", dialect: "POSTGRES" },
          { name: "BILLING", dialect: "H2" },
        ],
      }),
    ).toThrowError(/more than once/);
  });

  it("rejects unknown fields and bad enums", () => {
    expect(() => parseManifest({ datasources: [{ name: "x", dialect: "ORACLE" }] })).toThrowError(
      UsageError,
    );
    expect(() => parseManifest({ nope: [] })).toThrowError(UsageError);
  });
});

describe("planApply", () => {
  it("plans a full no-op for a manifest matching the server state", () => {
    const plan = planApply(parseManifest(upToDateManifest()), datasourcesTree(), { prune: false });
    expect(plan.actions).toEqual([]);
    expect(plan.unchanged).toEqual([
      "datasource billing",
      "dataset billing.public.invoices",
      "dataset billing.public.orders",
      "datasource crm",
    ]);
  });

  it("treats case-variant identities as the same resource (no perpetual diff)", () => {
    const manifest = parseManifest({
      datasources: [
        { name: "BILLING", dialect: "POSTGRES", datasets: [{ ...invoices, tableName: "INVOICES" }, orders] },
        { name: "crm", dialect: "MYSQL" },
      ],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toEqual([]);
  });

  it("creates a missing datasource together with its datasets, in order", () => {
    const manifest = parseManifest({
      datasources: [{ name: "wh", dialect: "H2", datasets: [orders] }],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions.map((a) => a.kind)).toEqual(["create-datasource", "create-dataset"]);
    expect(plan.actions[1]).toMatchObject({ datasourceName: "wh" });
    expect(plan.actions[1]).not.toHaveProperty("datasourceNodeId", expect.any(String));
  });

  it("creates a missing dataset under an existing datasource with its node id", () => {
    const manifest = parseManifest({
      datasources: [
        { name: "billing", dialect: "POSTGRES", datasets: [invoices, orders, { ...orders, tableName: "refunds", title: "Refunds" }] },
      ],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      kind: "create-dataset",
      datasourceNodeId: "node-ds-billing",
    });
  });

  it("updates mutable datasource fields and reports what changed", () => {
    const manifest = parseManifest({
      datasources: [
        { name: "billing", dialect: "MARIADB", description: "New text", datasets: [invoices, orders] },
      ],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      kind: "update-datasource",
      nodeId: "node-ds-billing",
      changes: ["dialect", "description"],
    });
  });

  it("leaves a description alone when the manifest omits it", () => {
    // The fixture's billing datasource has a description; the manifest omits it.
    const plan = planApply(parseManifest(upToDateManifest()), datasourcesTree(), { prune: false });
    expect(plan.actions).toEqual([]);
  });

  it("carries the server description into an update when the manifest omits it", () => {
    const manifest = parseManifest({
      datasources: [{ name: "billing", dialect: "MARIADB", datasets: [invoices, orders] }],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions[0]).toMatchObject({
      kind: "update-datasource",
      changes: ["dialect"],
      datasource: { description: "Billing DB" },
    });
  });

  it("updates a dataset when mutable fields differ", () => {
    const manifest = parseManifest({
      datasources: [
        {
          name: "billing",
          dialect: "POSTGRES",
          datasets: [invoices, { ...orders, title: "Orders v2", pkName: "order_id", pkType: "STRING" }],
        },
      ],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      kind: "update-dataset",
      nodeId: "node-dset-orders",
      changes: ["title", "pkName", "pkType"],
    });
  });

  it("ignores dataSchema key order when diffing", () => {
    const reordered = {
      ...invoices,
      dataSchema: { properties: { amount: { type: "number" } }, type: "object" },
    };
    const manifest = parseManifest({
      datasources: [{ name: "billing", dialect: "POSTGRES", datasets: [reordered, orders] }],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toEqual([]);
  });

  it("plans a clearing update when the manifest omits an existing dataSchema", () => {
    const manifest = parseManifest({
      datasources: [
        {
          name: "billing",
          dialect: "POSTGRES",
          datasets: [{ ...invoices, dataSchema: undefined }, orders],
        },
      ],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ kind: "update-dataset", changes: ["dataSchema"] });
  });

  it("prunes only undeclared datasets under declared datasources, after mutations", () => {
    const manifest = parseManifest({
      datasources: [
        {
          name: "billing",
          dialect: "POSTGRES",
          datasets: [invoices, { ...orders, tableName: "refunds", title: "Refunds" }],
        },
      ],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: true });
    expect(plan.actions.map((a) => a.kind)).toEqual(["create-dataset", "delete-dataset"]);
    expect(plan.actions[1]).toMatchObject({
      kind: "delete-dataset",
      nodeId: "node-dset-orders",
      code: "billing.public.orders",
    });
    // The undeclared "crm" datasource is never touched.
  });

  it("does not delete anything without --prune", () => {
    const manifest = parseManifest({
      datasources: [{ name: "billing", dialect: "POSTGRES", datasets: [invoices] }],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions).toEqual([]);
  });
});

describe("describeAction", () => {
  it("renders one line per action kind", () => {
    const manifest = parseManifest({
      datasources: [{ name: "wh", dialect: "H2", datasets: [orders] }],
    });
    const plan = planApply(manifest, datasourcesTree(), { prune: false });
    expect(plan.actions.map(describeAction)).toEqual([
      "create datasource wh (H2)",
      "create dataset wh.public.orders",
    ]);
  });
});
