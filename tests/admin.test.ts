import { describe, it, expect, afterEach, vi } from "vitest";
import { clearWorkspace } from "../src/commands/admin/clear.js";
import { undoClear } from "../src/commands/admin/undo-clear.js";
import { resetDemo } from "../src/commands/admin/reset-demo.js";
import { seedDemo } from "../src/commands/admin/seed-demo.js";
import { harness, type Reply } from "./_harness.js";
import { ExitCode } from "../src/lib/errors.js";

const CLEAR = "/api/v1/admin/workspaces/default/clear";
const UNDO_CLEAR = "/api/v1/admin/workspaces/default/undo-clear";
const SEED_DEMO = "/api/v1/admin/workspaces/default/seed-demo";

/** Success is a 204 with no body on all three endpoints. */
const ok = () => undefined;

const NOT_EMPTY: Reply = {
  status: 400,
  body: { message: "Demo seeding requires an empty workspace — clear the workspace first" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin clear", () => {
  it("posts to the clear path and points at the recovery routes", async () => {
    const h = harness(ok);
    await clearWorkspace(h.ctx, { yes: true });
    expect(h.calls).toEqual([{ method: "POST", path: CLEAR }]);
    const status = h.stderr.join("");
    expect(status).toContain("Workspace cleared");
    expect(status).toContain("undo-clear");
  });

  it("refuses without --yes when it cannot prompt, and issues nothing", async () => {
    const h = harness(ok);
    await expect(clearWorkspace(h.ctx, {})).rejects.toMatchObject({ exitCode: ExitCode.Usage });
    expect(h.calls).toEqual([]);
  });
});

describe("admin undo-clear", () => {
  it("posts to the undo-clear path and says what is not restored", async () => {
    const h = harness(ok);
    await undoClear(h.ctx);
    expect(h.calls).toEqual([{ method: "POST", path: UNDO_CLEAR }]);
    expect(h.stderr.join("")).toContain("original ids");
  });

  it("renders the closed-window message with no request-level hint, and does not retry", async () => {
    const h = harness(() => ({ status: 400, body: { message: "Nothing to undo — no clear recorded" } }));
    const err = await undoClear(h.ctx).catch((e: unknown) => e);
    expect(err).toMatchObject({
      message: "Nothing to undo — no clear recorded",
      exitCode: ExitCode.Api,
      hint: undefined,
    });
    expect(h.calls).toHaveLength(1);
  });

  it("keeps the other precondition message intact", async () => {
    const message =
      "Undo is only available while the workspace is still empty — something has been created since the clear";
    const h = harness(() => ({ status: 400, body: { message } }));
    await expect(undoClear(h.ctx)).rejects.toMatchObject({ message, hint: undefined });
  });
});

describe("admin seed-demo", () => {
  it("reports a creation, not a merge", async () => {
    const h = harness(ok);
    await seedDemo(h.ctx);
    expect(h.calls).toEqual([{ method: "POST", path: SEED_DEMO }]);
    const status = h.stderr.join("");
    expect(status).toContain("Demo data seeded");
    expect(status).not.toContain("preserved");
  });

  it("turns the non-empty 400 into a pointer at admin clear", async () => {
    const h = harness(() => NOT_EMPTY);
    const err = await seedDemo(h.ctx).catch((e: unknown) => e);
    expect(err).toMatchObject({
      message: "Demo seeding requires an empty workspace — clear the workspace first",
      exitCode: ExitCode.Api,
    });
    expect((err as { hint?: string }).hint).toContain("arkveil admin clear");
  });

  it("leaves an unrelated 400 alone", async () => {
    const h = harness(() => ({ status: 400, body: { message: "Something else went wrong" } }));
    await expect(seedDemo(h.ctx)).rejects.toMatchObject({
      status: 400,
      serverMessage: "Something else went wrong",
    });
  });
});

describe("admin reset-demo", () => {
  it("issues clear then seed-demo, in that order — there is no server-side reset", async () => {
    const h = harness(ok);
    await resetDemo(h.ctx, { yes: true });
    expect(h.calls.map((c) => c.path)).toEqual([CLEAR, SEED_DEMO]);
    expect(h.stderr.join("")).toContain("Workspace cleared and demo data reseeded");
  });

  it("refuses without --yes when it cannot prompt, and issues nothing", async () => {
    const h = harness(ok);
    await expect(resetDemo(h.ctx, {})).rejects.toMatchObject({ exitCode: ExitCode.Usage });
    expect(h.calls).toEqual([]);
  });

  it("does not seed when the clear fails", async () => {
    const h = harness((call) =>
      call.path === CLEAR ? { status: 403, body: { message: "Forbidden" } } : undefined,
    );
    await expect(resetDemo(h.ctx, { yes: true })).rejects.toMatchObject({ status: 403 });
    expect(h.calls.map((c) => c.path)).toEqual([CLEAR]);
  });

  it("surfaces a failing seed after the workspace has already been cleared", async () => {
    const h = harness((call) => (call.path === SEED_DEMO ? NOT_EMPTY : undefined));
    await expect(resetDemo(h.ctx, { yes: true })).rejects.toMatchObject({ exitCode: ExitCode.Api });
    expect(h.calls.map((c) => c.path)).toEqual([CLEAR, SEED_DEMO]);
    expect(h.stderr.join("")).toContain("The clear went through — the workspace is empty");
  });
});
