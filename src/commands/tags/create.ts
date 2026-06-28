import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTag } from "./_format.js";
import type { CreateTagRequest, Tag } from "../../lib/types.js";

export interface CreateTagOptions {
  slug: string;
  color: string;
  tooltip?: string;
  description?: string;
}

/** Create a tag (POST /tags). */
export async function createTag(ctx: CliContext, options: CreateTagOptions): Promise<void> {
  const body: CreateTagRequest = {
    slug: options.slug,
    color: options.color,
    ...(options.tooltip !== undefined ? { tooltip: options.tooltip } : {}),
    ...(options.description !== undefined ? { description: options.description } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Creating tag…");
  let tag: Tag;
  try {
    tag = await unwrap(client.POST("/api/v1/tags", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not create tag.");
    throw err;
  }
  ctx.out.success(`Created tag ${tag.slug} (${tag.id}).`);
  ctx.out.data(tag, (o) => renderTag(o, tag));
}
