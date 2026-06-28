import type { CliContext } from "../../lib/context.js";
import {
  requestDeviceCode,
  pollForToken,
  saveToken,
  openBrowser,
} from "../../lib/auth.js";

export interface LoginOptions {
  browser: boolean;
}

/**
 * Authenticate via the OAuth 2.0 Device Authorization Grant: request a device
 * code, show/open the verification URL, then poll until the user approves.
 */
export async function login(
  ctx: CliContext,
  options: LoginOptions,
): Promise<void> {
  const { config, out } = ctx;

  const requesting = out.spinner("Requesting device authorization…");
  let info;
  try {
    info = await requestDeviceCode(config, out);
    requesting.stop();
  } catch (err) {
    requesting.fail("Device authorization request failed.");
    throw err;
  }

  const verifyUrl = info.verificationUriComplete ?? info.verificationUri;

  // Print the verification details on stderr regardless of --json/--quiet so
  // the user can always complete the interactive step.
  process.stderr.write(
    `\n  Open this URL to authorize:\n    ${out.c.cyan(verifyUrl)}\n` +
      `  Then enter the code: ${out.c.bold(info.userCode)}\n\n`,
  );

  const canOpen = options.browser && out.opts.isTty;
  if (canOpen && (await openBrowser(verifyUrl, out))) {
    out.info("Opened your browser to the verification page.");
  }

  const waiting = out.spinner("Waiting for authorization…");
  let token;
  try {
    token = await pollForToken(config, info, out, {
      onTick: (secondsLeft) =>
        waiting.update(`Waiting for authorization… (${secondsLeft}s left)`),
    });
    waiting.stop();
  } catch (err) {
    waiting.fail("Authorization was not completed.");
    throw err;
  }

  const creds = await saveToken(config, token, out);

  if (out.opts.json) {
    out.json({
      status: "authenticated",
      storage: creds.storage,
      tokenType: creds.tokenType,
      expiresAt: creds.expiresAt ?? null,
      baseUrl: creds.baseUrl,
    });
  } else {
    out.success(
      `Authenticated. Token saved via ${creds.storage === "keychain" ? "OS keychain" : `file (${config.configDir})`}.`,
    );
    if (creds.expiresAt) out.info(`Token expires at ${creds.expiresAt}.`);
  }
}
