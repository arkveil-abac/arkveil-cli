import { describe, it, expect, afterEach, vi } from "vitest";
import { runTest } from "../src/commands/tests/run.js";
import { harness, type RecordedCall, type Reply } from "./_harness.js";
import type { TestRunDTO } from "../src/lib/types.js";

const ID = "0f8f6c3e-1f2a-4c5b-9d7e-2a1b3c4d5e6f";
const NODE_RUN = `/api/v1/navigation/tests/${ID}/run`;
const RESOURCE_RUN = `/api/v1/tests/${ID}/run`;

function passedRun(): TestRunDTO {
  return {
    id: "run-1",
    testId: "res-1",
    triggeredAt: "2026-08-16T10:00:00Z",
    completedAt: "2026-08-16T10:00:01Z",
    status: "PASSED",
    summary: { totalCount: 1, passedCount: 1, failedCount: 0, errorCount: 0 },
    resolvedActionCodes: ["orders:read"],
    resolvedDatasetCodes: [],
    results: [],
  };
}

/** The three ways the node endpoint refuses an id, per the kernel contract. */
const ROUTE_ABSENT: Reply = { status: 500, body: { message: "Internal server error" } };
const NOT_A_NODE_HERE: Reply = { status: 404, body: { message: `Node not found: ${ID}` } };
const WRONG_KIND: Reply = {
  status: 400,
  body: { message: "Node of type RESOURCE was expected but found FOLDER instead" },
};

/** Answer the node endpoint with `nodeReply`, the resource endpoint with `resourceReply`. */
function routes(nodeReply: Reply, resourceReply: Reply) {
  return (call: RecordedCall): Reply => (call.path === NODE_RUN ? nodeReply : resourceReply);
}

const OK: Reply = { status: 200, body: passedRun() };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tests run — id resolution", () => {
  it("runs a node id against the node endpoint, with no fallback call", async () => {
    const h = harness(routes(OK, OK));
    await runTest(h.ctx, ID);
    expect(h.calls.map((c) => c.path)).toEqual([NODE_RUN]);
  });

  it("falls back to the resource endpoint when the node endpoint 404s", async () => {
    const h = harness(routes(NOT_A_NODE_HERE, OK));
    await runTest(h.ctx, ID);
    expect(h.calls.map((c) => c.path)).toEqual([NODE_RUN, RESOURCE_RUN]);
    expect(h.stdout.join("")).toContain("PASSED");
  });

  it("falls back on a 500, so kernels predating the node route still work", async () => {
    const h = harness(routes(ROUTE_ABSENT, OK));
    await runTest(h.ctx, ID);
    expect(h.calls.map((c) => c.path)).toEqual([NODE_RUN, RESOURCE_RUN]);
  });

  it("reports a 400 as-is: the node exists and is the wrong kind, so a retry resolves nothing", async () => {
    const h = harness(routes(WRONG_KIND, OK));
    await expect(runTest(h.ctx, ID)).rejects.toMatchObject({
      status: 400,
      serverMessage: "Node of type RESOURCE was expected but found FOLDER instead",
    });
    expect(h.calls.map((c) => c.path)).toEqual([NODE_RUN]);
  });

  it("surfaces the fallback's own error when the id is neither a node nor a test", async () => {
    const h = harness(
      routes(NOT_A_NODE_HERE, { status: 404, body: { message: `Test not found: ${ID}` } }),
    );
    const err = await runTest(h.ctx, ID).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 404, serverMessage: `Test not found: ${ID}` });
    expect(h.calls.map((c) => c.path)).toEqual([NODE_RUN, RESOURCE_RUN]);
  });
});

describe("tests run — outcome", () => {
  it("exits with the test-failed code when the run did not pass", async () => {
    const failed = { ...passedRun(), status: "FAILED" as const };
    failed.summary = { totalCount: 1, passedCount: 0, failedCount: 1, errorCount: 0 };
    const h = harness(routes({ status: 200, body: failed }, OK));
    await expect(runTest(h.ctx, ID)).rejects.toMatchObject({ exitCode: 8 });
  });
});
