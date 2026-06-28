import { describe, it, expect, vi, afterEach } from "vitest";
import { Output, display } from "../src/lib/output.js";
import type { OutputOptions } from "../src/lib/config.js";

function makeOptions(overrides: Partial<OutputOptions> = {}): OutputOptions {
  return { json: false, quiet: false, verbose: false, color: false, isTty: false, ...overrides };
}

function captureStdout(): { lines: () => string; restore: () => void } {
  let buffer = "";
  const spy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      buffer += chunk.toString();
      return true;
    });
  return { lines: () => buffer, restore: () => spy.mockRestore() };
}

function captureStderr(): { lines: () => string; restore: () => void } {
  let buffer = "";
  const spy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: string | Uint8Array) => {
      buffer += chunk.toString();
      return true;
    });
  return { lines: () => buffer, restore: () => spy.mockRestore() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Output.data", () => {
  it("prints JSON in --json mode and skips the human renderer", () => {
    const out = new Output(makeOptions({ json: true }));
    const cap = captureStdout();
    const renderer = vi.fn(() => "human");
    out.data({ a: 1, b: [2, 3] }, renderer);
    cap.restore();
    expect(renderer).not.toHaveBeenCalled();
    expect(JSON.parse(cap.lines())).toEqual({ a: 1, b: [2, 3] });
  });

  it("prints the human rendering when not in JSON mode", () => {
    const out = new Output(makeOptions());
    const cap = captureStdout();
    out.data({ a: 1 }, () => "rendered line");
    cap.restore();
    expect(cap.lines().trim()).toBe("rendered line");
  });
});

describe("Output.table", () => {
  it("aligns columns and includes a header separator", () => {
    const out = new Output(makeOptions());
    const table = out.table(["ID", "NAME"], [["1", "alpha"], ["20", "b"]]);
    const rows = table.split("\n");
    expect(rows[0]).toContain("ID");
    expect(rows[0]).toContain("NAME");
    // data rows present
    expect(table).toContain("alpha");
    expect(table).toContain("20");
  });
});

describe("Output.keyValue", () => {
  it("renders aligned key: value pairs", () => {
    const out = new Output(makeOptions());
    const kv = out.keyValue([
      ["id", "abc"],
      ["status", "ok"],
    ]);
    expect(kv).toContain("id:");
    expect(kv).toContain("abc");
    expect(kv).toContain("status:");
  });
});

describe("Output message channels", () => {
  it("suppresses info in --json mode", () => {
    const out = new Output(makeOptions({ json: true }));
    const cap = captureStderr();
    out.info("hello");
    cap.restore();
    expect(cap.lines()).toBe("");
  });

  it("suppresses info in --quiet mode", () => {
    const out = new Output(makeOptions({ quiet: true }));
    const cap = captureStderr();
    out.info("hello");
    cap.restore();
    expect(cap.lines()).toBe("");
  });

  it("still shows warnings under --quiet", () => {
    const out = new Output(makeOptions({ quiet: true }));
    const cap = captureStderr();
    out.warn("careful");
    cap.restore();
    expect(cap.lines()).toContain("careful");
  });
});

describe("Output.error", () => {
  it("emits a JSON error object in --json mode", () => {
    const out = new Output(makeOptions({ json: true }));
    const cap = captureStderr();
    out.error("boom", { hint: "do x", exitCode: 6 });
    cap.restore();
    expect(JSON.parse(cap.lines())).toEqual({ error: { message: "boom", hint: "do x", exitCode: 6 } });
  });

  it("prints message and hint in human mode", () => {
    const out = new Output(makeOptions());
    const cap = captureStderr();
    out.error("boom", { hint: "do x" });
    cap.restore();
    expect(cap.lines()).toContain("boom");
    expect(cap.lines()).toContain("do x");
  });
});

describe("Output.spinner", () => {
  it("returns a no-op spinner when not a TTY (no throw)", () => {
    const out = new Output(makeOptions({ isTty: false }));
    const cap = captureStderr();
    const spinner = out.spinner("working");
    expect(() => spinner.update("still").succeed("done").stop()).not.toThrow();
    cap.restore();
  });
});

describe("display()", () => {
  it("coerces values to strings", () => {
    expect(display("x")).toBe("x");
    expect(display(5)).toBe("5");
    expect(display(null)).toBe("");
    expect(display({ a: 1 })).toBe('{"a":1}');
  });
});
