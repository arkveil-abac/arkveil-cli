/**
 * Helpers for accepting JSON payloads on the command line. Complex request
 * bodies (DSL, request schemas, attribute maps, ASTs) are supplied via a
 * `--data` value that is one of: inline JSON, `@path/to/file.json`, or `-`
 * (read from stdin).
 */
import { readFileSync } from "node:fs";
import { UsageError } from "./errors.js";

/** Read and parse a `--data` style value into an unknown JSON value. */
export async function readJsonInput(value: string | undefined, flag = "--data"): Promise<unknown> {
  if (value === undefined) return undefined;

  let text: string;
  if (value === "-") {
    text = await readStdin();
    if (!text.trim()) throw new UsageError(`No data received on stdin for ${flag}.`, "Pipe JSON in, or pass inline JSON / @file.");
  } else if (value.startsWith("@")) {
    const path = value.slice(1);
    try {
      text = readFileSync(path, "utf8");
    } catch {
      throw new UsageError(`Unable to read ${flag} file at ${path}.`, "Check the path exists and is readable.");
    }
  } else {
    text = value;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UsageError(
      `${flag} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      "Provide well-formed JSON (inline, @file, or - for stdin).",
    );
  }
}

/** Parse an inline JSON object value for a flag, asserting it is an object. */
export function parseJsonObjectFlag(value: string | undefined, flag: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new UsageError(`${flag} must be valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new UsageError(`${flag} must be a JSON object (e.g. '{"role":"admin"}').`);
  }
  return parsed as Record<string, unknown>;
}

/** Assert that an already-parsed value is a JSON object. */
export function asObject(value: unknown, flag: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UsageError(`${flag} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}
