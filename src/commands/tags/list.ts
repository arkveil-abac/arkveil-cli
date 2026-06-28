import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import type { Tag } from "../../lib/types.js";

/** List all tags (GET /tags). */
export async function listTags(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Fetching tags…");
  let tags: Tag[];
  try {
    tags = (await unwrap(client.GET("/api/v1/tags"), "GET")) ?? [];
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch tags.");
    throw err;
  }

  ctx.out.data(tags, (o) => {
    if (tags.length === 0) return o.c.dim("No tags found.");
    return o.table(
      ["ID", "SLUG", "COLOR", "TOOLTIP"],
      tags.map((t) => [t.id, t.slug, t.color, t.tooltip ?? ""]),
    );
  });
}
