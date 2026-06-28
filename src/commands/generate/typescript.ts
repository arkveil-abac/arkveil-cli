import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { UsageError } from "../../lib/errors.js";
import type {
  AttributeSchemaResponse,
  ResolvedNavigationTree,
  ResolvedNavigationNode,
} from "../../lib/types.js";
import type { JsonSchema } from "../../lib/json-schema-to-ts.js";
import {
  assembleTypeScript,
  type AssembleInput,
  type GenerateInclude,
} from "./assemble.js";

export interface GenerateTsOptions {
  include?: string;
  output?: string;
}

const ALL_INCLUDES: GenerateInclude[] = ["codes", "user", "context"];

function parseInclude(value: string | undefined): GenerateInclude[] {
  if (value === undefined) return ALL_INCLUDES;
  const items = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (items.length === 0) {
    throw new UsageError(
      "--include must list at least one of: codes, user, context.",
      "Example: --include user,context",
    );
  }
  const invalid = items.filter((i) => !ALL_INCLUDES.includes(i as GenerateInclude));
  if (invalid.length > 0) {
    throw new UsageError(
      `Unknown --include value(s): ${invalid.join(", ")}.`,
      "Allowed values are: codes, user, context.",
    );
  }
  // Preserve canonical order, drop duplicates.
  return ALL_INCLUDES.filter((i) => items.includes(i));
}

/** Recursively collect every ACTION resource code from a navigation tree. */
function collectActionCodes(node: ResolvedNavigationNode, into: Set<string>): void {
  if (node.resourceType === "ACTION" && node.resource && "code" in node.resource) {
    const code = (node.resource as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) into.add(code);
  }
  for (const child of node.children ?? []) {
    collectActionCodes(child as ResolvedNavigationNode, into);
  }
}

async function fetchSchema(
  ctx: CliContext,
  type: "user" | "context",
): Promise<JsonSchema> {
  const client = await ctx.getClient({ requireAuth: true });
  const res: AttributeSchemaResponse = await unwrap(
    client.GET("/api/v1/attribute-schemas/{type}", { params: { path: { type } } }),
    "GET",
  );
  return (res.jsonSchema ?? {}) as JsonSchema;
}

async function fetchActionCodes(ctx: CliContext): Promise<string[]> {
  const client = await ctx.getClient({ requireAuth: true });
  const tree: ResolvedNavigationTree = await unwrap(
    client.GET("/api/v1/navigation/trees/actions"),
    "GET",
  );
  const codes = new Set<string>();
  if (tree?.root) collectActionCodes(tree.root, codes);
  return [...codes].sort();
}

/**
 * Generate a TypeScript file that types the Arkveil SDK (permission codes plus
 * `user`/`context` attributes) from this project's codes and attribute schemas.
 *
 * Without `--output`, the TypeScript is written to stdout (pipe it to a file).
 * With `--output <file>`, it is written there and a status line goes to stderr.
 */
export async function generateTypeScript(
  ctx: CliContext,
  options: GenerateTsOptions,
): Promise<void> {
  const include = parseInclude(options.include);

  const spinner = ctx.out.spinner("Generating TypeScript…");
  const input: AssembleInput = {};
  let codes: string[] = [];
  try {
    if (include.includes("codes")) {
      codes = await fetchActionCodes(ctx);
      input.codes = codes;
    }
    if (include.includes("user")) {
      input.userSchema = await fetchSchema(ctx, "user");
    }
    if (include.includes("context")) {
      input.contextSchema = await fetchSchema(ctx, "context");
    }
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not generate TypeScript.");
    throw err;
  }

  const code = assembleTypeScript(input);

  if (include.includes("codes") && codes.length === 0) {
    ctx.out.warn(
      "No permission codes found; ArkveilCodes falls back to `string`. Define actions first.",
    );
  }

  if (options.output) {
    const target = resolve(process.cwd(), options.output);
    writeFileSync(target, code, "utf8");
    ctx.out.success(`Wrote ${include.join(", ")} TypeScript to ${target}`);
    ctx.out.data({ output: target, include, codeCount: codes.length }, () => undefined);
    return;
  }

  ctx.out.data(
    { language: "typescript", include, codeCount: codes.length, code },
    () => code,
  );
}
