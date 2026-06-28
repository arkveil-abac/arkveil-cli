import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { UsageError } from "../../lib/errors.js";
import type { UserSettings } from "../../lib/types.js";

export interface SetSettingsOptions {
  theme?: UserSettings["theme"];
  uiMode?: UserSettings["uiMode"];
}

/**
 * Update user settings (PUT /me/settings). The API requires the full object, so
 * we fetch the current settings and overlay only the provided flags.
 */
export async function setSettings(ctx: CliContext, options: SetSettingsOptions): Promise<void> {
  if (options.theme === undefined && options.uiMode === undefined) {
    throw new UsageError("Nothing to update.", "Pass --theme and/or --ui-mode.");
  }

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner("Updating settings…");
  let updated: UserSettings;
  try {
    const current = await unwrap(client.GET("/api/v1/me/settings"), "GET");
    const body: UserSettings = {
      theme: options.theme ?? current.theme,
      uiMode: options.uiMode ?? current.uiMode,
    };
    updated = await unwrap(client.PUT("/api/v1/me/settings", { body }), "PUT");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not update settings.");
    throw err;
  }

  ctx.out.success("Settings updated.");
  ctx.out.data(updated, (o) =>
    o.keyValue([
      ["theme", updated.theme],
      ["uiMode", updated.uiMode],
    ]),
  );
}
