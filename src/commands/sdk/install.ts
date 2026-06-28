import type { CliContext } from "../../lib/context.js";
import { UsageError } from "../../lib/errors.js";
import { SDK_CATALOG, SDK_TARGET_IDS, findTarget } from "./catalog.js";

/**
 * Print the npm install command for an SDK target — handy for agents/scripts
 * that just want the command to run. `--json` returns { package, install }.
 */
export function sdkInstall(ctx: CliContext, target: string): Promise<void> {
  const t = findTarget(target);
  if (!t) {
    throw new UsageError(
      `Unknown SDK target "${target}".`,
      `Choose one of: ${SDK_TARGET_IDS.join(", ")}.`,
    );
  }

  ctx.out.data(
    { id: t.id, package: t.package, install: t.install, registry: SDK_CATALOG.registry },
    () => t.install,
  );
  return Promise.resolve();
}
