import { describe, it, expect } from "vitest";
import {
  canonical,
  findDatasourceNode,
  findDatasetNode,
  findNodeById,
  datasetNodesUnder,
  type TreeNode,
} from "../src/commands/_resolve.js";
import type { ResolvedNavigationTree, DatasetDTO } from "../src/lib/types.js";

/** Minimal datasources tree the way the server resolves it: a root folder with
 * datasource nodes whose children are their dataset nodes. */
export function datasourcesTree(): ResolvedNavigationTree {
  return {
    dagType: "DATASOURCES",
    root: {
      id: "root-1",
      title: "Datasources",
      type: "FOLDER",
      root: true,
      children: [
        {
          id: "node-ds-billing",
          title: "billing",
          type: "RESOURCE",
          root: false,
          resourceType: "DATASOURCE",
          resource: {
            id: "res-ds-billing",
            name: "billing",
            dialect: "POSTGRES",
            description: "Billing DB",
          },
          children: [
            {
              id: "node-dset-invoices",
              title: "Invoices",
              type: "RESOURCE",
              root: false,
              resourceType: "DATASET",
              resource: {
                id: "res-dset-invoices",
                code: "billing.public.invoices",
                datasource: "billing",
                dbSchema: "public",
                tableName: "invoices",
                pkName: "id",
                pkType: "UUID",
                title: "Invoices",
                dataSchema: { type: "object", properties: { amount: { type: "number" } } },
              },
              children: [],
            },
            {
              id: "node-dset-orders",
              title: "Orders",
              type: "RESOURCE",
              root: false,
              resourceType: "DATASET",
              resource: {
                id: "res-dset-orders",
                code: "billing.public.orders",
                datasource: "billing",
                dbSchema: "public",
                tableName: "orders",
                pkName: "id",
                pkType: "LONG",
                title: "Orders",
                dataSchema: {},
              },
              children: [],
            },
          ],
        },
        {
          id: "node-ds-crm",
          title: "crm",
          type: "RESOURCE",
          root: false,
          resourceType: "DATASOURCE",
          resource: { id: "res-ds-crm", name: "crm", dialect: "MYSQL" },
          children: [],
        },
      ],
    },
  };
}

describe("canonical", () => {
  it("trims and lowercases, matching server canonicalization", () => {
    expect(canonical("  Billing ")).toBe("billing");
  });
});

describe("findDatasourceNode", () => {
  it("finds a datasource by name and returns the DAG node (not the resource)", () => {
    const node = findDatasourceNode(datasourcesTree(), "billing");
    expect(node?.id).toBe("node-ds-billing");
  });

  it("matches case-insensitively the way the server canonicalizes names", () => {
    expect(findDatasourceNode(datasourcesTree(), "  BILLING ")?.id).toBe("node-ds-billing");
  });

  it("returns undefined for an unknown datasource", () => {
    expect(findDatasourceNode(datasourcesTree(), "nope")).toBeUndefined();
  });
});

describe("findDatasetNode", () => {
  it("finds a dataset by canonical code", () => {
    const node = findDatasetNode(datasourcesTree().root as TreeNode, "Billing.Public.ORDERS");
    expect(node?.id).toBe("node-dset-orders");
  });
});

describe("findNodeById / datasetNodesUnder", () => {
  it("finds a node anywhere in the tree by DAG node id", () => {
    expect(findNodeById(datasourcesTree().root as TreeNode, "node-dset-invoices")?.title).toBe(
      "Invoices",
    );
  });

  it("lists the dataset nodes nested under a datasource node", () => {
    const datasource = findNodeById(datasourcesTree().root as TreeNode, "node-ds-billing")!;
    const codes = datasetNodesUnder(datasource).map((n) => (n.resource as DatasetDTO).code);
    expect(codes).toEqual(["billing.public.invoices", "billing.public.orders"]);
  });

  it("returns no datasets for a datasource without children", () => {
    const datasource = findNodeById(datasourcesTree().root as TreeNode, "node-ds-crm")!;
    expect(datasetNodesUnder(datasource)).toEqual([]);
  });
});
