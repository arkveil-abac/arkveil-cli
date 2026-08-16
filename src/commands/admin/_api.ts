/**
 * The workspace admin endpoints, in one place because `reset-demo` is no longer
 * a server operation: it is a `clear` followed by a `seed-demo`.
 */
import { unwrap, type ArkveilClient } from "../../lib/api-client.js";

/** Hard-delete every authorization entity and navigation node (POST .../clear). */
export async function postClear(client: ArkveilClient): Promise<void> {
  await unwrap(client.POST("/api/v1/admin/workspaces/default/clear"), "POST");
}

/** Create the canonical demo workspace (POST .../seed-demo). Empty workspace only. */
export async function postSeedDemo(client: ArkveilClient): Promise<void> {
  await unwrap(client.POST("/api/v1/admin/workspaces/default/seed-demo"), "POST");
}

/** Restore the last clear (POST .../undo-clear). Empty workspace only. */
export async function postUndoClear(client: ArkveilClient): Promise<void> {
  await unwrap(client.POST("/api/v1/admin/workspaces/default/undo-clear"), "POST");
}
