import { UsageError } from "../../lib/errors.js";
import type { WriteOperation } from "../../lib/types.js";

const OPERATIONS: readonly string[] = ["CREATE", "UPDATE", "DELETE"];

/**
 * Parse `--operations CREATE,UPDATE` into the request array. An empty value
 * parses to an empty array and is sent as such — the server's "must declare
 * the operations" 400 is the answer, never a synthesized default.
 */
export function parseOperationsFlag(value: string | undefined): WriteOperation[] | undefined {
  if (value === undefined) return undefined;
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const unknown = tokens.filter((token) => !OPERATIONS.includes(token));
  if (unknown.length > 0) {
    throw new UsageError(
      `--operations got ${unknown.join(", ")}; the operations are CREATE, UPDATE, DELETE.`,
      "TOUCH policies govern a non-empty subset of UPDATE,DELETE; RESULT policies govern a non-empty subset of CREATE,UPDATE.",
    );
  }
  return tokens as WriteOperation[];
}
