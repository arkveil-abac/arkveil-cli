/**
 * `arkveil update` — check the npm registry for a newer release and, unless
 * `--check` is given, upgrade this install in place via the package manager that
 * owns it. In `--json` mode it reports the version delta and what it did (or
 * would do) without any spinners.
 */
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { CliContext } from "../../lib/context.js";
import { CliError, ExitCode } from "../../lib/errors.js";
import {
  compareSemver,
  detectPackageManager,
  fetchLatestVersion,
  installCommand,
  readPackageMeta,
  type PackageManager,
} from "./npm.js";

export interface UpdateOptions {
  /** Only report whether an update is available; do not install. */
  check?: boolean;
  /** Print the install command that would run, without executing it. */
  dryRun?: boolean;
  /** dist-tag to target (default "latest"). */
  tag?: string;
  /** Override the auto-detected package manager. */
  use?: PackageManager;
  /** Reinstall even when already on the target version. */
  force?: boolean;
}

const VALID_PMS: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

export async function selfUpdate(ctx: CliContext, options: UpdateOptions): Promise<void> {
  const { out, config } = ctx;
  const meta = readPackageMeta();
  const tag = options.tag ?? "latest";

  if (options.use && !VALID_PMS.includes(options.use)) {
    throw new CliError(`Unknown package manager "${options.use}".`, {
      exitCode: ExitCode.Usage,
      hint: `Choose one of: ${VALID_PMS.join(", ")}.`,
    });
  }

  const spinner = out.spinner(`Checking npm for ${meta.name}@${tag}…`);
  let latest: string;
  try {
    latest = await fetchLatestVersion({
      name: meta.name,
      tag,
      timeoutMs: config.timeoutMs,
    });
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not check for updates.");
    throw err;
  }

  const cmp = compareSemver(meta.version, latest);
  const upToDate = cmp >= 0;
  const willUpdate = !upToDate || Boolean(options.force);
  const pm = options.use ?? detectPackageManager(fileURLToPath(import.meta.url));
  const spec = `${meta.name}@${tag}`;
  const { cmd, args } = installCommand(pm, spec);
  const commandLine = `${cmd} ${args.join(" ")}`;

  // Report-only paths: --check, --dry-run, or already current with no --force.
  if (options.check || options.dryRun || !willUpdate) {
    out.data(
      {
        name: meta.name,
        current: meta.version,
        latest,
        tag,
        updateAvailable: !upToDate,
        upToDate,
        packageManager: pm,
        command: commandLine,
        action: options.dryRun
          ? "dry-run"
          : options.check
            ? "check"
            : "none",
      },
      (o) => {
        if (upToDate) {
          return `${o.c.green("✔")} ${meta.name} is up to date (${meta.version}).`;
        }
        const lines = [
          `${o.c.yellow("!")} Update available: ${o.c.dim(meta.version)} → ${o.c.green(latest)}`,
        ];
        if (options.dryRun) {
          lines.push(`  Would run: ${o.c.cyan(commandLine)}`);
        } else {
          lines.push(`  Run ${o.c.cyan("arkveil update")} to upgrade (uses: ${o.c.cyan(commandLine)}).`);
        }
        return lines.join("\n");
      },
    );
    return;
  }

  // Perform the upgrade.
  const label = upToDate
    ? `Reinstalling ${spec}…`
    : `Updating ${meta.name} ${meta.version} → ${latest}…`;
  out.verbose(`Running: ${commandLine}`);
  const install = out.spinner(label);
  try {
    await runInstall(cmd, args);
    install.succeed(`Updated to ${latest}. Run \`arkveil --version\` to confirm.`);
  } catch (err) {
    install.fail("Update failed.");
    throw toInstallError(err, pm, commandLine);
  }

  out.data(
    {
      name: meta.name,
      previous: meta.version,
      latest,
      tag,
      packageManager: pm,
      command: commandLine,
      action: "updated",
    },
    () => {},
  );
}

/** Run the install command, capturing output so we can surface it on failure. */
function runInstall(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

interface ExecError extends Error {
  code?: string | number;
  stderr?: string;
}

/** Turn an execFile failure into an actionable CliError. */
function toInstallError(err: unknown, pm: PackageManager, commandLine: string): CliError {
  const e = err as ExecError;
  if (e?.code === "ENOENT") {
    return new CliError(`${pm} was not found on your PATH.`, {
      exitCode: ExitCode.Generic,
      hint: `Install ${pm}, or pass --use <npm|pnpm|yarn|bun> to pick another package manager.`,
      cause: err,
    });
  }
  const detail = (e?.stderr ?? e?.message ?? String(err)).trim().split("\n").slice(-3).join(" ");
  return new CliError(`Upgrade command failed: ${detail || commandLine}`, {
    exitCode: ExitCode.Generic,
    hint: `Try running it yourself: ${commandLine}. A global install may require elevated permissions (sudo).`,
    cause: err,
  });
}
