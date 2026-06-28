import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTag } from "./_format.js";
import type { UpdateTagRequest, Tag } from "../../lib/types.js";

export interface UpdateTagOptions {
  color: string;
  tooltip?: string;
  description?: string;
}

/** Update a tag (PUT /tags/{id}). `color` is required by the API. */
export async function updateTag(ctx: CliContext, id: string, options: UpdateTagOptions): Promise<void> {
  const body: UpdateTagRequest = {
    color: options.color,
    ...(options.tooltip !== undefined ? { tooltip: options.tooltip } : {}),
    ...(options.description !== undefined ? { description: options.description } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Updating tag ${id}…`);
  let tag: Tag;
  try {
    tag = await unwrap(client.PUT("/api/v1/tags/{id}", { params: { path: { id } }, body }), "PUT");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update tag.");
    throw err;
  }
  ctx.out.success(`Updated tag ${tag.slug} (${tag.id}).`);
  ctx.out.data(tag, (o) => renderTag(o, tag));
}
