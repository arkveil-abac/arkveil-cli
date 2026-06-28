import { describe, it, expect } from "vitest";
import {
  schemaToType,
  schemaToNamedType,
  type JsonSchema,
} from "../src/lib/json-schema-to-ts.js";
import { assembleTypeScript } from "../src/commands/generate/assemble.js";

describe("schemaToType", () => {
  it("maps primitives (integer → number)", () => {
    expect(schemaToType({ type: "string" })).toBe("string");
    expect(schemaToType({ type: "integer" })).toBe("number");
    expect(schemaToType({ type: "number" })).toBe("number");
    expect(schemaToType({ type: "boolean" })).toBe("boolean");
  });

  it("renders enums and const as literal unions", () => {
    expect(schemaToType({ type: "string", enum: ["a", "b"] })).toBe('"a" | "b"');
    expect(schemaToType({ const: "x" })).toBe('"x"');
    expect(schemaToType({ enum: [1, 2] })).toBe("1 | 2");
  });

  it("treats type arrays and OpenAPI nullable as unions with null", () => {
    expect(schemaToType({ type: ["string", "null"] })).toBe("string | null");
    expect(schemaToType({ type: "string", nullable: true })).toBe("string | null");
  });

  it("renders arrays, wrapping unions in parens", () => {
    expect(schemaToType({ type: "array", items: { type: "string" } })).toBe("string[]");
    expect(
      schemaToType({ type: "array", items: { type: "string", enum: ["a", "b"] } }),
    ).toBe('("a" | "b")[]');
    expect(schemaToType({ type: "array" })).toBe("unknown[]");
  });

  it("renders objects with required/optional properties", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { id: { type: "string" }, age: { type: "integer" } },
      required: ["id"],
    };
    expect(schemaToType(schema)).toBe("{\n  id: string;\n  age?: number;\n}");
  });

  it("falls back to a record for property-less objects", () => {
    expect(schemaToType({ type: "object" })).toBe("Record<string, unknown>");
    expect(schemaToType({ type: "object", additionalProperties: false })).toBe(
      "Record<string, never>",
    );
    expect(
      schemaToType({ type: "object", additionalProperties: { type: "string" } }),
    ).toBe("{\n  [key: string]: string;\n}");
  });

  it("quotes non-identifier keys", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { "x-tenant": { type: "string" } },
      required: ["x-tenant"],
    };
    expect(schemaToType(schema)).toContain('"x-tenant": string;');
  });

  it("resolves local $ref against $defs and guards cycles", () => {
    const schema: JsonSchema = {
      $defs: { Role: { type: "string", enum: ["admin", "user"] } },
      type: "object",
      properties: { role: { $ref: "#/$defs/Role" } },
      required: ["role"],
    };
    expect(schemaToType(schema)).toBe('{\n  role: "admin" | "user";\n}');
  });

  it("handles anyOf as a union and unknown as a fallback", () => {
    expect(
      schemaToType({ anyOf: [{ type: "string" }, { type: "number" }] }),
    ).toBe("string | number");
    expect(schemaToType({})).toBe("unknown");
  });
});

describe("schemaToNamedType", () => {
  it("emits an interface for object shapes", () => {
    const out = schemaToNamedType("ArkveilUserAttributes", {
      type: "object",
      properties: { role: { type: "string", enum: ["admin", "viewer"] } },
      required: ["role"],
    });
    expect(out).toBe(
      'export interface ArkveilUserAttributes {\n  role: "admin" | "viewer";\n}',
    );
  });

  it("emits a type alias for non-object shapes, with a JSDoc when given", () => {
    const out = schemaToNamedType("ArkveilContextAttributes", { type: "object" }, "ctx");
    expect(out).toBe(
      "/** ctx */\nexport type ArkveilContextAttributes = Record<string, unknown>;",
    );
  });
});

describe("assembleTypeScript", () => {
  const userSchema: JsonSchema = {
    type: "object",
    properties: { role: { type: "string", enum: ["admin", "viewer"] } },
    required: ["role"],
  };

  it("emits codes, attributes, and a full registry augmentation", () => {
    const out = assembleTypeScript({
      codes: ["b.delete", "a.create"],
      userSchema,
      contextSchema: { type: "object" },
    });
    expect(out).toContain("arkveil generate typescript");
    expect(out).toContain("export type ArkveilCodes =");
    expect(out).toContain('| "b.delete"');
    expect(out).toContain("export interface ArkveilUserAttributes");
    expect(out).toContain('declare module "arkveil"');
    expect(out).toContain("interface ArkveilCodeRegistry");
    expect(out).toContain("interface ArkveilUserRegistry");
    expect(out).toContain("interface ArkveilContextRegistry");
  });

  it("falls back to string when no codes exist", () => {
    const out = assembleTypeScript({ codes: [] });
    expect(out).toContain("export type ArkveilCodes = string;");
  });

  it("includes only the requested sections", () => {
    const out = assembleTypeScript({ userSchema });
    expect(out).toContain("interface ArkveilUserRegistry");
    expect(out).not.toContain("ArkveilCodeRegistry");
    expect(out).not.toContain("ArkveilContextRegistry");
  });
});
