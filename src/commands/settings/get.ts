import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import type { UserSettings } from "../../lib/types.js";

/** Show the current user settings (GET /me/settings). */
export async function getSettings(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Fetching settings…");
  let settings: UserSettings;
  try {
    settings = await unwrap(client.GET("/api/v1/me/settings"), "GET");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch settings.");
    throw err;
  }
  ctx.out.data(settings, (o) =>
    o.keyValue([
      ["theme", settings.theme],
      ["uiMode", settings.uiMode],
    ]),
  );
}
