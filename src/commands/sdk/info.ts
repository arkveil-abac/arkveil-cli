import type { CliContext } from "../../lib/context.js";
import { UsageError } from "../../lib/errors.js";
import {
  SDK_CATALOG,
  SDK_TARGET_IDS,
  findTarget,
  renderCatalog,
} from "./catalog.js";

/**
 * Print how to install and use the Arkveil SDK (no network / auth required).
 *
 * With no argument, emits the full catalog: every target, its install command,
 * a usage snippet, and the typed-attributes recipe. With a target, narrows to
 * just that package. In `--json` mode, emits the machine-readable catalog so an
 * AI coding agent can decide which package to install and how to type it.
 */
export function sdkInfo(ctx: CliContext, target?: string): Promise<void> {
  if (target !== undefined && !findTarget(target)) {
    throw new UsageError(
      `Unknown SDK target "${target}".`,
      `Choose one of: ${SDK_TARGET_IDS.join(", ")}.`,
    );
  }

  const selected = target ? findTarget(target) : undefined;
  const jsonValue = selected
    ? { ...SDK_CATALOG, targets: [selected] }
    : SDK_CATALOG;

  ctx.out.data(jsonValue, () => renderCatalog(selected));
  return Promise.resolve();
}
