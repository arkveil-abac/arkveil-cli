/**
 * Typed error hierarchy and process exit codes.
 *
 * Every user-facing failure in the CLI is represented by a `CliError`. The
 * global error handler (see `src/index.ts`) inspects `exitCode` and prints
 * `message` plus an actionable `hint` — never a raw stack trace.
 */

/** Canonical, documented exit codes. Keep in sync with the README. */
export const ExitCode = {
  /** Command completed successfully. */
  Success: 0,
  /** Generic / unexpected failure. */
  Generic: 1,
  /** Invalid usage: bad flags, missing arguments, etc. */
  Usage: 2,
  /** Authentication required or rejected (401/403, no stored token). */
  Auth: 3,
  /** The requested resource does not exist (404). */
  NotFound: 4,
  /** Network failure or request timeout. */
  Network: 5,
  /** The API returned an error response (4xx/5xx) with a message. */
  Api: 6,
  /** Local configuration is invalid or unreadable. */
  Config: 7,
  /** A test ran and its assertion did not hold. */
  TestFailed: 8,
  /** A test could not run at all (missing action, deleted dataset, stale fixture). */
  TestError: 9,
  /** The user cancelled an interactive prompt. */
  Cancelled: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Base class for all errors the CLI knows how to present cleanly. */
export class CliError extends Error {
  readonly exitCode: ExitCodeValue;
  /** A short, imperative suggestion for what the user should do next. */
  readonly hint: string | undefined;

  constructor(
    message: string,
    options: { exitCode?: ExitCodeValue; hint?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.exitCode = options.exitCode ?? ExitCode.Generic;
    this.hint = options.hint;
  }
}

/** Invalid CLI usage (bad/missing flags or arguments). */
export class UsageError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: ExitCode.Usage, hint });
  }
}

/** Local configuration could not be read, parsed, or validated. */
export class ConfigError extends CliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { exitCode: ExitCode.Config, hint, cause });
  }
}

/** No credentials available, or the server rejected them. */
export class AuthError extends CliError {
  constructor(
    message: string,
    hint = "Run `arkveil login` to authenticate.",
    cause?: unknown,
  ) {
    super(message, { exitCode: ExitCode.Auth, hint, cause });
  }
}

/** The network request failed before a response was received. */
export class NetworkError extends CliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { exitCode: ExitCode.Network, hint, cause });
  }
}

/** A request exceeded the configured timeout. */
export class TimeoutError extends NetworkError {
  constructor(timeoutMs: number, url: string, cause?: unknown) {
    super(
      `Request to ${url} timed out after ${timeoutMs}ms.`,
      "Increase the timeout with --timeout <ms> or check that the API is reachable.",
      cause,
    );
  }
}

/** The interactive prompt was cancelled (Ctrl-C). */
export class CancelledError extends CliError {
  constructor(message = "Operation cancelled.") {
    super(message, { exitCode: ExitCode.Cancelled });
  }
}

/**
 * The API returned a non-2xx response. Maps HTTP status to the most specific
 * exit code and a helpful hint.
 */
export class ApiError extends CliError {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly serverMessage: string | undefined;

  constructor(args: {
    status: number;
    url: string;
    method: string;
    serverMessage?: string;
    requestId?: string;
  }) {
    const { status, url, method, serverMessage, requestId } = args;
    const exitCode =
      status === 401 || status === 403
        ? ExitCode.Auth
        : status === 404
          ? ExitCode.NotFound
          : ExitCode.Api;

    const summary =
      serverMessage && serverMessage.trim().length > 0
        ? serverMessage
        : `${status} ${statusText(status)}`;

    super(`API request failed (${method} ${url}): ${summary}`, {
      exitCode,
      hint: hintForStatus(status),
    });

    this.status = status;
    this.requestId = requestId;
    this.serverMessage = serverMessage;
  }
}

function hintForStatus(status: number): string | undefined {
  if (status === 401) return "Your session may have expired. Run `arkveil login`.";
  if (status === 403) return "Your account lacks permission for this operation.";
  if (status === 404) return "Check that the id is correct (try the matching `list`/`trees` command).";
  if (status === 400) return "The request was rejected as invalid — review the flags and any --data payload.";
  if (status === 429) return "Rate limited. Wait a moment and retry.";
  if (status >= 500) return "The server reported an internal error. Retry shortly; if it persists, contact the API operators.";
  return undefined;
}

function statusText(status: number): string {
  const map: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return map[status] ?? "Error";
}

/** Type guard for our error hierarchy. */
export function isCliError(err: unknown): err is CliError {
  return err instanceof CliError;
}
