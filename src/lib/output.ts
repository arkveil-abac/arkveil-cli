/**
 * Output rendering: JSON vs human, color gating, spinners, tables.
 *
 * Contract: structured result data goes to **stdout**; status messages,
 * spinners, warnings, and verbose logs go to **stderr**. This keeps stdout a
 * clean, pipe-able stream — in `--json` mode stdout is always valid JSON.
 */
import { createColors } from "picocolors";
import oraFactory, { type Ora } from "ora";
import type { OutputOptions } from "./config.js";

export type Colors = ReturnType<typeof createColors>;

/** Minimal spinner contract so callers don't depend on ora directly. */
export interface Spinner {
  start(text?: string): Spinner;
  update(text: string): Spinner;
  succeed(text?: string): Spinner;
  fail(text?: string): Spinner;
  stop(): Spinner;
}

class NoopSpinner implements Spinner {
  constructor(
    private readonly write: (line: string) => void,
    private readonly enabled: boolean,
  ) {}
  start(text?: string): Spinner {
    if (this.enabled && text) this.write(text);
    return this;
  }
  update(): Spinner {
    return this;
  }
  succeed(): Spinner {
    return this;
  }
  fail(): Spinner {
    return this;
  }
  stop(): Spinner {
    return this;
  }
}

class OraSpinner implements Spinner {
  private readonly ora: Ora;
  constructor(text: string) {
    this.ora = oraFactory({ text, stream: process.stderr });
  }
  start(text?: string): Spinner {
    this.ora.start(text);
    return this;
  }
  update(text: string): Spinner {
    this.ora.text = text;
    return this;
  }
  succeed(text?: string): Spinner {
    this.ora.succeed(text);
    return this;
  }
  fail(text?: string): Spinner {
    this.ora.fail(text);
    return this;
  }
  stop(): Spinner {
    this.ora.stop();
    return this;
  }
}

export class Output {
  readonly opts: OutputOptions;
  readonly c: Colors;

  constructor(opts: OutputOptions) {
    this.opts = opts;
    this.c = createColors(opts.color);
  }

  /** Write a raw line to stdout (the data channel). */
  print(line = ""): void {
    process.stdout.write(`${line}\n`);
  }

  /** Pretty-print a value as JSON to stdout. */
  json(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }

  /**
   * Emit a result. In `--json` mode prints JSON; otherwise invokes the human
   * renderer, which returns the string to write (or writes nothing for void).
   */
  data(value: unknown, renderHuman: (out: Output) => string | void): void {
    if (this.opts.json) {
      this.json(value);
      return;
    }
    const rendered = renderHuman(this);
    if (typeof rendered === "string") this.print(rendered);
  }

  /** Informational status message (stderr). Suppressed by --quiet and --json. */
  info(line: string): void {
    if (this.opts.quiet || this.opts.json) return;
    process.stderr.write(`${line}\n`);
  }

  /** Success message with a check mark (stderr). */
  success(line: string): void {
    if (this.opts.quiet || this.opts.json) return;
    process.stderr.write(`${this.c.green("✔")} ${line}\n`);
  }

  /** Warning (stderr). Shown even with --quiet, suppressed only in --json. */
  warn(line: string): void {
    if (this.opts.json) return;
    process.stderr.write(`${this.c.yellow("!")} ${line}\n`);
  }

  /** Verbose diagnostic (stderr). Only when --verbose and not --json. */
  verbose(line: string): void {
    if (!this.opts.verbose || this.opts.json) return;
    process.stderr.write(`${this.c.dim(`[verbose] ${line}`)}\n`);
  }

  /**
   * Render an error to stderr. Always shown (even with --quiet). In --json mode
   * emits a single-line JSON error object so scripts can parse failures too.
   */
  error(message: string, opts: { hint?: string; exitCode?: number } = {}): void {
    if (this.opts.json) {
      process.stderr.write(
        `${JSON.stringify({ error: { message, hint: opts.hint ?? null, exitCode: opts.exitCode ?? 1 } })}\n`,
      );
      return;
    }
    process.stderr.write(`${this.c.red("✖")} ${message}\n`);
    if (opts.hint) process.stderr.write(`  ${this.c.dim("→")} ${opts.hint}\n`);
  }

  /**
   * Create a spinner. Disabled (no animation) when output is non-TTY, piped,
   * `--json`, or `--quiet`; in those cases network calls run silently.
   */
  spinner(text: string): Spinner {
    const animate = this.opts.isTty && this.opts.color && !this.opts.json && !this.opts.quiet;
    if (animate) return new OraSpinner(text).start();
    return new NoopSpinner((line) => this.info(line), !this.opts.json && !this.opts.quiet).start(text);
  }

  /** Render an array of records as an aligned text table. */
  table(headers: string[], rows: string[][]): string {
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
    );
    const pad = (cells: string[]): string =>
      cells.map((cell, i) => (cell ?? "").padEnd(widths[i] ?? 0)).join("  ").trimEnd();
    const head = this.c.bold(pad(headers));
    const sep = this.c.dim(widths.map((w) => "─".repeat(w)).join("  "));
    return [head, sep, ...rows.map(pad)].join("\n");
  }

  /** Render a single record as aligned key: value lines. */
  keyValue(entries: Array<[string, string]>): string {
    const keyWidth = Math.max(0, ...entries.map(([k]) => k.length));
    return entries
      .map(([k, v]) => `${this.c.dim(`${k}:`.padEnd(keyWidth + 1))} ${v}`)
      .join("\n");
  }
}

/** Coerce any value into a stable display string for tables/key-value output. */
export function display(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
