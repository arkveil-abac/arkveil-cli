import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { readJsonInput, asObject } from "../../lib/input.js";
import { UsageError } from "../../lib/errors.js";
import type {
  AttributeSchemaResponse,
  AttributeSchemaType,
  UpdateAttributeSchemaRequest,
} from "../../lib/types.js";

export interface SetSchemaOptions {
  data?: string;
}

/** Replace the JSON Schema for an attribute type (PUT /attribute-schemas/{type}). */
export async function setSchema(
  ctx: CliContext,
  type: AttributeSchemaType,
  options: SetSchemaOptions,
): Promise<void> {
  if (options.data === undefined) {
    throw new UsageError(
      "A JSON Schema document is required.",
      "Pass it with --data '<json>', --data @schema.json, or --data - (stdin).",
    );
  }
  const jsonSchema = asObject(await readJsonInput(options.data, "--data"), "--data");
  const body: UpdateAttributeSchemaRequest = { jsonSchema };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating ${type} attribute schema…`);
  let res: AttributeSchemaResponse;
  try {
    res = await unwrap(
      client.PUT("/api/v1/attribute-schemas/{type}", { params: { path: { type } }, body }),
      "PUT",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update attribute schema.");
    throw err;
  }

  ctx.out.success(`Updated ${type} attribute schema.`);
  ctx.out.data(res, () => JSON.stringify(res.jsonSchema ?? {}, null, 2));
}
