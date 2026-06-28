# arkveil-cli

A command-line interface for the **Arkveil Kernel API** — navigation
trees, actions, targets, policies, tags, access tests, attribute schemas, and
ABAC (attribute-based access control) operations.

The CLI is generated against the API's OpenAPI 3.1 specification, so its request
and response types are fully derived from the spec.

---

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Authentication](#authentication)
- [Global flags](#global-flags)
- [Configuration & environment](#configuration--environment)
- [Exit codes](#exit-codes)
- [Commands](#commands)
- [JSON output & scripting](#json-output--scripting)
- [Development](#development)

---

## Install

Requires **Node.js ≥ 20**.

```bash
# from a published package
npm install -g arkveil-cli

# or run without installing
npx arkveil-cli --help
```

From source:

```bash
pnpm install
pnpm build
node bin/cli.js --help
# or link it onto your PATH:
npm link
arkveil --help
```

---

## Quick start

```bash
# 1. Point at your API (default is https://api.arkveil.com)
export ARKVEIL_BASE_URL="https://kernel.example.com"

# 2. Authenticate (opens your browser to approve)
arkveil auth login

# 3. Confirm who you are
arkveil auth whoami

# 4. Use it
arkveil health
arkveil trees forest
arkveil tags list
arkveil eval explain -a orders:read --user '{"role":"admin"}' --context '{}'
```

---

## Authentication

The CLI authenticates with the **OAuth 2.0 Device Authorization Grant**
(RFC 8628), as implemented by the backend's **better-auth Device Authorization**
plugin.

```bash
arkveil auth login              # request a device code, open the browser, poll for the token
arkveil auth login --no-browser # print the URL/code instead of opening a browser
arkveil auth logout             # remove stored credentials
arkveil auth whoami             # show current auth state (verifies the token by default)
arkveil auth whoami --no-verify # skip the verification API call
```

`login` requests a device code, shows you a verification URL and short user code,
opens your browser, and then polls until you approve — handling
`authorization_pending`, `slow_down`, `expired_token`, and `access_denied`.

The resulting token is sent as `Authorization: Bearer <token>` on every request.

### Credential storage

Tokens are stored in the **OS keychain** when [`keytar`](https://www.npmjs.com/package/keytar)
is available; otherwise they fall back to `~/.config/arkveil/credentials.json`,
written with `0600` permissions. `arkveil auth whoami` reports which storage
backend is in use. Use `arkveil logout` to clear both.

You can bypass stored credentials entirely with an explicit token:

```bash
arkveil --api-key "$TOKEN" tags list
# or
ARKVEIL_TOKEN="$TOKEN" arkveil tags list
```

> **Note on the spec.** The bundled OpenAPI document defines no security scheme or
> device-flow endpoints. The device-flow endpoints are therefore derived from
> configuration and default to better-auth conventions
> (`<auth-base-url>/device/code` and `/device/token`, where `auth-base-url`
> defaults to `<base-url>/api/auth`). Override them via the environment if your
> deployment differs (see below). The API also exposes a **Workspace API Keys**
> resource (`arkveil keys …`) that you can use to mint long-lived keys to pass via
> `--api-key`.

---

## Global flags

These apply to **every** command:

| Flag                 | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `--json`             | Emit machine-readable JSON to stdout; disables spinners and color.        |
| `-q, --quiet`        | Suppress non-essential status messages.                                   |
| `-v, --verbose`      | Print transport diagnostics (method, URL, request id, retries) to stderr. |
| `--no-color`         | Disable ANSI color.                                                       |
| `--base-url <url>`   | Override the API base URL.                                                |
| `--api-key <token>`  | Bearer token to use, overriding stored credentials.                       |
| `--config-dir <dir>` | Directory for config and credentials.                                     |
| `--timeout <ms>`     | Per-request timeout in milliseconds.                                      |
| `-V, --version`      | Print the CLI version.                                                    |
| `-h, --help`         | Show help (available on every command and subcommand).                    |

Color and spinners are also disabled automatically when stdout is **not a TTY**
(e.g. piped) or when `NO_COLOR` is set.

---

## Configuration & environment

Configuration is resolved with the precedence: **CLI flags > environment
variables > config file > built-in defaults**.

### Config file

`~/.config/arkveil/config.json` (or `$XDG_CONFIG_HOME/arkveil/config.json`, or a
`--config-dir`). Validated at runtime; unknown keys are rejected.

```json
{
  "baseUrl": "https://kernel.example.com",
  "authBaseUrl": "https://auth.example.com/api/auth",
  "clientId": "arkveil-cli",
  "deviceCodePath": "/device/code",
  "deviceTokenPath": "/device/token",
  "timeoutMs": 30000,
  "retries": 2
}
```

### Environment variables

| Variable                | Purpose                                     | Default                   |
| ----------------------- | ------------------------------------------- | ------------------------- |
| `ARKVEIL_BASE_URL`      | API base URL                                | `https://api.arkveil.com` |
| `ARKVEIL_AUTH_BASE_URL` | better-auth mount point                     | `<base-url>/api/auth`     |
| `ARKVEIL_CLIENT_ID`     | Device-flow client id                       | `arkveil-cli`             |
| `ARKVEIL_SCOPE`         | Optional OAuth scope                        | _(unset)_                 |
| `ARKVEIL_TOKEN`         | Bearer token (overrides stored credentials) | _(unset)_                 |
| `ARKVEIL_TIMEOUT`       | Request timeout (ms)                        | `30000`                   |
| `ARKVEIL_RETRIES`       | Retry attempts for idempotent requests      | `2`                       |
| `ARKVEIL_CONFIG_DIR`    | Config/credentials directory                | `~/.config/arkveil`       |
| `NO_COLOR`              | Disable color when set                      | _(unset)_                 |

### Networking behavior

- **Timeouts**: every request is bounded by `--timeout` (default 30s).
- **Retries**: idempotent requests (`GET`/`PUT`/`DELETE`) are retried with
  exponential backoff on `429`/`502`/`503`/`504` and network errors, honoring
  `Retry-After`. `POST`/`PATCH` are never retried.
- **Request IDs**: every request carries an `x-request-id` header, shown under
  `--verbose`.
- **Pagination**: the API returns full collections (no pagination parameters), so
  list commands return complete results.

---

## Exit codes

| Code  | Meaning                              |
| ----- | ------------------------------------ |
| `0`   | Success                              |
| `1`   | Generic / unexpected error           |
| `2`   | Usage error (bad flags or arguments) |
| `3`   | Authentication required or rejected  |
| `4`   | Resource not found (404)             |
| `5`   | Network failure or timeout           |
| `6`   | API returned an error response       |
| `7`   | Invalid local configuration          |
| `130` | Cancelled at an interactive prompt   |

Errors are printed as a one-line message plus an actionable hint — never a raw
stack trace. Re-run with `--verbose` for the underlying cause.

---

## Commands

Run `arkveil <group> --help` or `arkveil <group> <command> --help` for full,
auto-generated usage with examples.

### `auth` — authentication

```bash
arkveil auth login [--no-browser]
arkveil auth logout
arkveil auth whoami [--no-verify]
```

### `health` — connectivity check

```bash
arkveil health
```

### `keys` — workspace API keys

```bash
arkveil keys list
arkveil keys create          # secret is shown once
```

### `tags`

```bash
arkveil tags list
arkveil tags get <id>
arkveil tags create --slug pii --color '#e11' [--tooltip <t>] [--description <d>]
arkveil tags update <id> --color '#f00' [--tooltip <t>] [--description <d>]
arkveil tags delete <id> [--yes]
```

### `trees` — navigation trees (read-only)

```bash
arkveil trees forest
arkveil trees tests
arkveil trees data-policies
arkveil trees actions
arkveil trees action-policies
```

### `folders`

```bash
arkveil folders create --parent <id> --title <t> [--description <d>]
arkveil folders update <folderId> --title <t> [--description <d>]
arkveil folders delete <folderId> [--yes]
```

### `actions`

```bash
arkveil actions create --parent <id> --service <svc> --name <n> --title <t> \
  [--tag <slug> ...] [--description <d>] [--request-schema <json|@file|->]
arkveil actions update <actionNodeId> --title <t> [--tag <slug> ...] \
  [--description <d>] [--request-schema <json|@file|->]
arkveil actions delete <actionNodeId> [--yes]
```

### `targets`

```bash
arkveil targets create --parent <id> --type ACTION|DATA --mode INDIVIDUAL|CUSTOM|ALL \
  --title <t> [--action-code <code>] [--dataset-id <id>] [--condition <dsl>] \
  [--request-schema <json|@file|->]
arkveil targets update <targetNodeId> --title <t> [--condition <dsl>] [--request-schema <...>]
arkveil targets delete <targetNodeId> [--yes]
arkveil targets suggest --condition '<dsl>'    # suggest a request schema from a condition
```

### `policies` (attached to a target)

```bash
arkveil policies create <targetNodeId> --type PERMISSION|READ|WRITE|INVARIANT|PROJECTION \
  --status ENABLED|DISABLED|DRAFT|DELETED --title <t> \
  [--condition <dsl>] [--filter <dsl>] [--projection <json|@file|->]
arkveil policies update <targetNodeId> <policyId> --status <s> --title <t> [...]
arkveil policies delete <targetNodeId> <policyId> [--yes]
```

### `tests` — access tests

```bash
arkveil tests create --parent <id> --name <n> --status DRAFT \
  --selector-type ACTION_SET|FORMULA|ALL_ACTIONS --expected-access GRANTED|DENIED \
  [--action-code <code> ...] [--formula <dsl>] \
  [--user '<json>'] [--context '<json>'] [--tag <slug> ...] \
  [--must-be-granted-by <policyId> ...]
arkveil tests update <testNodeId> --name <n> --status <s> --selector-type <t> --expected-access <a> [...]
arkveil tests set-status <testNodeId> --status ENABLED
arkveil tests delete <testNodeId> [--yes]
arkveil tests run <testId>
arkveil tests run-all
arkveil tests history [testId]      # per-test runs, or aggregate when no id given
arkveil tests run-info <runId>      # a single run with per-action results
```

### `settings` — user settings

```bash
arkveil settings get
arkveil settings set [--theme LIGHT|DARK|SYSTEM] [--ui-mode SIMPLE|STRUCTURED]
```

### `schemas` — attribute JSON schemas

```bash
arkveil schemas get  <user|context|action>
arkveil schemas set  <user|context|action> --data @schema.json
```

The `user` and `context` schemas drive the SDK's typed attributes — see
`arkveil sdk info` for the recipe that turns them into typed SDK code.

### `sdk` — SDK install & usage (for AI agents and humans)

The Arkveil SDK is for **TypeScript / JavaScript** today, in three packages:
NestJS (`@arkveil/nest`), Node.js/Express (`@arkveil/node`), and the
runtime-agnostic core (`arkveil`). `arkveil sdk` documents how to install and
use them — so an AI coding agent can integrate the SDK from a single command.

```bash
arkveil sdk info                       # all targets: install + usage + typing recipe
arkveil sdk info <nest|node|core>      # narrow to one package
arkveil sdk info --json                # machine-readable catalog for tooling/agents
arkveil sdk install <nest|node|core>   # just the npm install command
```

`arkveil sdk info --json` returns the supported language, every package with its
install command and a usage snippet, and the **typed-attributes recipe**: fetch
the user/context schemas (`arkveil schemas get user|context --json`), translate
them to TypeScript, and augment the SDK's `ArkveilUserRegistry` /
`ArkveilContextRegistry`. Once augmented, `getUserAttributes`,
`getContextAttributes`, and `checkPermission` are all type-checked.

### `formula` — formula DSL

```bash
arkveil formula parse --context ACTION_PERMISSION --dsl 'user.role == "admin"'
```

### `eval` — explain access decisions

```bash
arkveil eval explain -a orders:read --user '{"role":"admin"}' --context '{}' [--request '<json>']
```

### `abac` — ABAC SDK operations

```bash
arkveil abac check --code orders:read --user '<json>' --context '<json>' [--request '<json>']
arkveil abac read  --dataset-id <id> --user '<json>' --context '<json>' [--alias t]
arkveil abac write --dataset-id <id> --user '<json>' --context '<json>' [--id <rowId> ...]
arkveil abac action-data <service> <name>
```

### `admin` — workspace administration

```bash
arkveil admin seed-demo            # idempotent; preserves existing entities
arkveil admin reset-demo [--yes]   # DESTRUCTIVE: wipes all authz data, then reseeds
```

### JSON payloads (`--data`, `--request-schema`, `--projection`, …)

Flags that accept JSON take one of three forms:

```bash
--data '{"a":1}'        # inline JSON
--data @payload.json    # read from a file
--data -                # read from stdin
echo '{"a":1}' | arkveil schemas set user --data -
```

---

## JSON output & scripting

Add `--json` to any command to emit the raw API payload (or a small status object
for actions like `delete`/`login`) as JSON on stdout. In JSON mode, spinners and
color are disabled and status text is suppressed, so stdout is always valid JSON:

```bash
arkveil tags list --json | jq '.[].slug'
arkveil eval explain -a orders:read --user '{"role":"admin"}' --context '{}' --json | jq .granted
```

Errors in `--json` mode are emitted to **stderr** as a JSON object
(`{"error":{"message":…,"hint":…,"exitCode":…}}`) while the process exit code
still reflects the failure category (see [Exit codes](#exit-codes)).

Destructive commands (`delete`, `admin reset-demo`) prompt for confirmation when
interactive and **refuse** to run non-interactively unless `--yes` is passed — so
piped/CI usage never hangs.

---

## Development

```bash
pnpm install
pnpm gen:api      # regenerate the typed client from .docs/api.yaml
pnpm dev -- --help
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest (network is mocked; no live calls)
pnpm build        # tsup -> dist/ (publishable ESM + d.ts)
```

### Project layout

```
bin/cli.js                       # shebang wrapper -> dist/index.js
src/index.ts                     # entry: program wiring + global error handler
src/commands/<resource>/<action> # one file per command
src/lib/
  api-client.ts                  # typed openapi-fetch client + unwrap()
  generated/schema.d.ts          # openapi-typescript output (do not edit)
  config.ts                      # config precedence + validation
  context.ts                     # per-invocation context (config + output + client)
  auth.ts                        # device flow + credential store
  http.ts                        # timeout, retry/backoff, request ids
  output.ts                      # JSON/human renderers, color/spinner gating
  errors.ts                      # typed errors + exit codes
  input.ts                       # JSON payload parsing (--data/@file/-)
  types.ts                       # friendly aliases for generated schema types
tests/                           # vitest: config, output, api-client, http, auth
```

### Publishing

```bash
pnpm version <patch|minor|major>
pnpm publish        # runs prepublishOnly: typecheck + test + build
```

The package ships only `dist/`, `bin/`, and `README.md` (see `package.json`
`files`), with `bin.arkveil` pointing at `bin/cli.js`.
