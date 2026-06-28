import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import type { AttributeSchemaResponse, AttributeSchemaType } from "../../lib/types.js";

/** Get the JSON Schema for USER/CONTEXT/ACTION attributes (GET /attribute-schemas/{type}). */
export async function getSchema(ctx: CliContext, type: AttributeSchemaType): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Fetching ${type} attribute schema…`);
  let res: AttributeSchemaResponse;
  try {
    res = await unwrap(
      client.GET("/api/v1/attribute-schemas/{type}", { params: { path: { type } } }),
      "GET",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch attribute schema.");
    throw err;
  }

  ctx.out.data(res, (o) => {
    const header = o.keyValue([
      ["type", res.type ?? type.toUpperCase()],
      ["createdAt", res.createdAt ?? ""],
      ["updatedAt", res.updatedAt ?? ""],
    ]);
    return `${header}\n${o.c.bold("jsonSchema:")}\n${JSON.stringify(res.jsonSchema ?? {}, null, 2)}`;
  });
}
