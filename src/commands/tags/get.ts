import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { renderTag } from "./_format.js";
import type { Tag } from "../../lib/types.js";

/** Fetch a single tag by id (GET /tags/{id}). */
export async function getTag(ctx: CliContext, id: string): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Fetching tag ${id}…`);
  let tag: Tag;
  try {
    tag = await unwrap(client.GET("/api/v1/tags/{id}", { params: { path: { id } } }), "GET");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch tag.");
    throw err;
  }
  ctx.out.data(tag, (o) => renderTag(o, tag));
}
