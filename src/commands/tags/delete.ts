import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { confirmAction } from "../_confirm.js";

export interface DeleteTagOptions {
  yes?: boolean;
}

/** Delete a tag (DELETE /tags/{id}, 204). */
export async function deleteTag(ctx: CliContext, id: string, options: DeleteTagOptions): Promise<void> {
  await confirmAction(ctx, `Delete tag ${id}? This cannot be undone.`, options);

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Deleting tag ${id}…`);
  try {
    await unwrap(client.DELETE("/api/v1/tags/{id}", { params: { path: { id } } }), "DELETE");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not delete tag.");
    throw err;
  }

  if (ctx.out.opts.json) ctx.out.json({ status: "deleted", id });
  else ctx.out.success(`Deleted tag ${id}.`);
}
