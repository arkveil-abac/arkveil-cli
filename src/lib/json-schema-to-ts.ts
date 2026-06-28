/**
 * Minimal, dependency-free JSON Schema → TypeScript converter.
 *
 * Scoped to the constructs Arkveil attribute schemas use: objects with
 * `properties`/`required`, arrays, `enum`/`const`, primitives, nullable types
 * (`type: ["string","null"]` and OpenAPI `nullable`), `additionalProperties`,
 * `anyOf`/`oneOf`/`allOf`, and local `$ref` (`#/$defs/…`, `#/definitions/…`).
 * Anything it cannot model degrades to `unknown` rather than failing.
 *
 * It is intentionally not a full JSON Schema implementation — it produces clean,
 * human-reviewable types from the schemas the kernel actually serves.
 */

export type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  description?: string;
  format?: string;
  /** OpenAPI 3.0-style nullability. */
  nullable?: boolean;
  [k: string]: unknown;
};

/** A valid bare TypeScript identifier (otherwise the key gets quoted). */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

interface Ctx {
  root: JsonSchema;
  seen: Set<string>;
}

function tsLiteral(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/** Single-line, comment-safe text for a JSDoc block. */
function commentText(text: string): string {
  return text.replace(/\*\//g, "*\\/").replace(/\s+/g, " ").trim();
}

function indentOf(spaces: number): string {
  return " ".repeat(spaces);
}

function resolveRef(ref: string, ctx: Ctx): JsonSchema | undefined {
  const local = ref.match(/^#\/(\$defs|definitions)\/(.+)$/);
  if (!local) return undefined;
  const bag =
    local[1] === "$defs" ? ctx.root.$defs : ctx.root.definitions;
  const key = decodeURIComponent(local[2]!);
  return bag?.[key];
}

function needsParensForArray(t: string): boolean {
  return t.includes("|") || t.includes("&");
}

function arrayType(schema: JsonSchema, indent: number, ctx: Ctx): string {
  if (Array.isArray(schema.items)) {
    const tuple = schema.items.map((s) => schemaToType(s, indent, ctx)).join(", ");
    return `[${tuple}]`;
  }
  const item = schema.items ? schemaToType(schema.items, indent, ctx) : "unknown";
  return needsParensForArray(item) ? `(${item})[]` : `${item}[]`;
}

function objectType(schema: JsonSchema, indent: number, ctx: Ctx): string {
  const props = schema.properties ?? {};
  const keys = Object.keys(props);
  const required = new Set(schema.required ?? []);
  const inner = indent + 2;
  const lines: string[] = [];

  for (const key of keys) {
    const propSchema = props[key]!;
    const optional = required.has(key) ? "" : "?";
    const safeKey = IDENTIFIER.test(key) ? key : JSON.stringify(key);
    if (typeof propSchema.description === "string" && propSchema.description.trim()) {
      lines.push(`${indentOf(inner)}/** ${commentText(propSchema.description)} */`);
    }
    lines.push(
      `${indentOf(inner)}${safeKey}${optional}: ${schemaToType(propSchema, inner, ctx)};`,
    );
  }

  const ap = schema.additionalProperties;
  if (ap && ap !== true) {
    lines.push(`${indentOf(inner)}[key: string]: ${schemaToType(ap, inner, ctx)};`);
  } else if (ap === true) {
    lines.push(`${indentOf(inner)}[key: string]: unknown;`);
  }

  if (lines.length === 0) {
    return ap === false ? "Record<string, never>" : "Record<string, unknown>";
  }
  return `{\n${lines.join("\n")}\n${indentOf(indent)}}`;
}

function unionOf(schemas: JsonSchema[], indent: number, ctx: Ctx): string {
  const parts = dedupe(schemas.map((s) => schemaToType(s, indent, ctx)));
  return parts.length > 0 ? parts.join(" | ") : "unknown";
}

/** Convert a single JSON Schema node into a TypeScript type expression. */
export function schemaToType(
  schema: JsonSchema | boolean | undefined,
  indent = 0,
  ctx: Ctx = {
    root: typeof schema === "object" && schema ? schema : {},
    seen: new Set(),
  },
): string {
  if (schema === undefined || schema === true) return "unknown";
  if (schema === false) return "never";

  if (typeof schema.$ref === "string") {
    if (ctx.seen.has(schema.$ref)) return "unknown";
    const resolved = resolveRef(schema.$ref, ctx);
    if (!resolved) return "unknown";
    ctx.seen.add(schema.$ref);
    const t = schemaToType(resolved, indent, ctx);
    ctx.seen.delete(schema.$ref);
    return t;
  }

  if (schema.const !== undefined) return tsLiteral(schema.const);
  if (Array.isArray(schema.enum)) {
    const union = dedupe(schema.enum.map(tsLiteral));
    return union.length > 0 ? union.join(" | ") : "never";
  }

  if (Array.isArray(schema.anyOf)) return unionOf(schema.anyOf, indent, ctx);
  if (Array.isArray(schema.oneOf)) return unionOf(schema.oneOf, indent, ctx);
  if (Array.isArray(schema.allOf)) {
    const parts = dedupe(schema.allOf.map((s) => schemaToType(s, indent, ctx)));
    return parts.length > 0 ? parts.join(" & ") : "unknown";
  }

  const types = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];

  const withNullable = (t: string): string =>
    schema.nullable && !t.split("|").map((s) => s.trim()).includes("null")
      ? `${t} | null`
      : t;

  if (types.length === 0) return withNullable("unknown");

  if (types.length > 1) {
    const parts = dedupe(
      types.map((t) =>
        t === "null" ? "null" : schemaToType({ ...schema, type: t }, indent, ctx),
      ),
    );
    return parts.join(" | ");
  }

  switch (types[0]) {
    case "string":
      return withNullable("string");
    case "integer":
    case "number":
      return withNullable("number");
    case "boolean":
      return withNullable("boolean");
    case "null":
      return "null";
    case "array":
      return withNullable(arrayType(schema, indent, ctx));
    case "object":
      return withNullable(objectType(schema, indent, ctx));
    default:
      return withNullable("unknown");
  }
}

/**
 * Render a top-level named declaration for a schema: an `interface` when the
 * schema is an object shape, otherwise a `type` alias. `description` becomes a
 * leading JSDoc comment.
 */
export function schemaToNamedType(
  name: string,
  schema: JsonSchema,
  description?: string,
): string {
  const ctx: Ctx = { root: schema, seen: new Set() };
  const body = schemaToType(schema, 0, ctx);
  const doc =
    description && description.trim()
      ? `/** ${commentText(description)} */\n`
      : "";
  if (body.startsWith("{")) {
    return `${doc}export interface ${name} ${body}`;
  }
  return `${doc}export type ${name} = ${body};`;
}
