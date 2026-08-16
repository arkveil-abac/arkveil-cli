# arkveil-cli

A command-line interface for the **Arkveil Kernel API** — navigation
trees, datasources, datasets, actions, targets, policies, tags, access tests,
attribute schemas, and ABAC (attribute-based access control) operations.

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
arkveil trees all
arkveil tags list
arkveil eval explain -a orders:read --user '{"role":"admin"}'
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

### Workspaces & the auth split

Management commands (`datasources`, `datasets`, `targets`, `policies`, `apply`, …)
require a **logged-in user's session token** — there is no API-key access to the
management API. The decision endpoints (`arkveil abac …`) accept a workspace API
key instead. Without a workspace id the session falls back to the user's
**oldest** workspace, so multi-workspace users should always pass one explicitly
via `--workspace`, `ARKVEIL_WORKSPACE_ID`, or the `workspaceId` config key; it is
sent as `X-Workspace-Id` on every request.

---

## Global flags

These apply to **every** command:

| Flag                 | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `--json`             | Emit machine-readable JSON to stdout; disables spinners and color.        |
| `-q, --quiet`        | Suppress non-essential status messages.                                   |
| `-v, --verbose`      | Print transport diagnostics (method, URL, request id, retries) to stderr; also expands passing dataset test results. |
| `--no-color`         | Disable ANSI color.                                                       |
| `--base-url <url>`   | Override the API base URL.                                                |
| `--api-key <token>`  | Bearer token to use, overriding stored credentials.                       |
| `--workspace <id>`   | Workspace id, sent as `X-Workspace-Id` on every request.                  |
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
  "workspaceId": "00000000-0000-0000-0000-000000000000",
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
| `ARKVEIL_WORKSPACE_ID`  | Workspace id (`X-Workspace-Id` header)      | _(unset)_                 |
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
| `8`   | A test run FAILED (assertion mismatch) |
| `9`   | A test run ERRORed (the test could not run at all) |
| `130` | Cancelled at an interactive prompt   |

`8` and `9` come from `arkveil tests run` / `run-all`, so they work as CI gates;
`9` outranks `8` when a batch contains both.

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
arkveil trees all
arkveil trees tests
arkveil trees datasources
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

### `datasources`

```bash
arkveil datasources create --name <n> --dialect POSTGRES|MYSQL|MARIADB|H2 [--description <d>]
arkveil datasources update <datasourceNodeId> --dialect <dialect> [--description <d>]
arkveil datasources delete <datasourceNodeId> [--yes]
```

Names are lowercased server-side and **immutable** — renaming means delete +
recreate. Every mutation returns the full datasources tree; `create` prints the
new **DAG node id**, which is what `update`/`delete` (and `datasets create
--datasource`) take. Deletion is refused (400) while datasets still reference
the datasource.

### `datasets`

```bash
arkveil datasets create --datasource <nodeId> --db-schema <s> --table-name <t> \
  --pk-name <col> --pk-type UUID|LONG|STRING --title <title> \
  [--description <d>] [--data-schema <json|@file|->]
arkveil datasets update <datasetNodeId> --title <t> --pk-name <col> --pk-type <type> \
  [--description <d>] [--data-schema <json|@file|->]
arkveil datasets impact <datasetCode>
arkveil datasets delete <datasetNodeId> [--yes]
```

`dbSchema`/`tableName` are lowercased server-side and **immutable** (they form
the canonical dataset **code** `datasource.schema.table`, used by DATA targets,
`arkveil abac read/write`, and dataset tests). Neither they nor a datasource
name may be a Formula DSL keyword (`data`, `user`, `where`, …) — a dataset is
addressed by that code inside policy conditions, so such a segment would make
it unaddressable.

On `update`, omitting `--data-schema` keeps the current schema and `'{}'`
clears it. A data-schema **or primary-key** change re-parses every policy that
reads the dataset — DATA filters and PERMISSION conditions alike — and fails
atomically with the policy ids in the error.

Deletion has two blockers: DATA targets bound to the dataset, and permission
policies whose condition reads it. `arkveil datasets impact <code>` lists both
(computed from each policy's `referencedDatasetCodes`, so short references are
matched exactly like full codes) in the order they must go: referencing
policies → DATA targets → dataset → datasource.

### `apply` — declarative data manifest

```bash
arkveil apply --file @data.json [--dry-run] [--prune] [--yes]
cat data.json | arkveil apply --file -
```

Reads the datasources tree, diffs the manifest against it, and executes only
the needed creates/updates/deletes in dependency order (datasources before
their datasets; prune deletes last). Identities compare case-insensitively, so
case-variant manifests never show a perpetual diff. See
`arkveil apply --help` for the manifest shape and semantics — in short:

- Identity (`name`, `dbSchema`/`tableName`) is immutable; changing it plans a
  create of the new identity, and `--prune` deletes the old one.
- `dataSchema` is always applied in full: a dataset declared without one is
  applied with an **empty** schema.
- Datasource descriptions omitted from the manifest are left unchanged.
- Identity segments that are Formula DSL keywords are rejected before any call.
- `--prune` only deletes datasets under datasources declared in the manifest;
  it never touches undeclared datasources or targets.
- `--dry-run` prints the plan (`--json` for a machine-readable version); apply
  is idempotent, so a failed run can simply be re-run.

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
  --title <t> [--action-code <code>] [--dataset-code <code>] [--condition <dsl>] \
  [--request-schema <json|@file|->]
arkveil targets update <targetNodeId> --title <t> [--condition <dsl>] [--request-schema <...>]
arkveil targets delete <targetNodeId> [--yes]
arkveil targets suggest --condition '<dsl>'    # suggest a request schema from a condition
```

A DATA target binds a dataset by its canonical code (`--dataset-code
billing.public.invoice`), which the server lowercases.

### `policies` (attached to a target)

```bash
arkveil policies create <targetNodeId> --type PERMISSION|READ|WRITE|INVARIANT|PROJECTION \
  --status ENABLED|DISABLED|DRAFT|DELETED --title <t> \
  [--condition <dsl>] [--filter <dsl>] [--projection <json|@file|->]
arkveil policies update <targetNodeId> <policyId> --status <s> --title <t> [...]
arkveil policies delete <targetNodeId> <policyId> [--yes]
```

Dataset columns are read as **`data.<column>`** — the old `entity.` namespace
was removed with no compatibility shim, so a stale formula fails with a raw
parse error. The CLI warns about `entity.` before sending.

A PERMISSION condition may also fetch rows from a dataset:

```bash
arkveil policies create <targetNodeId> --type PERMISSION --status ENABLED \
  --title "Invoice owner approval" \
  --condition 'exists demo_billing.public.invoice where data.id = request.invoiceId and data.owner_id = user.id'
```

The dataset must exist **before** the policy is saved, and the reference must be
canonical lowercase (unlike a target's `datasetCode`, DSL text is not
normalized server-side). A bare table name (`exists invoice where …`) also
works, but it resolves against the workspace's live datasets *at save time* and
must match exactly one — so the same manifest can bind differently per
workspace, or start failing once a second `*.*.invoice` exists. Prefer full
codes in anything repeatable; the CLI warns on short ones. Every policy reports
what it actually bound as `referencedDatasetCodes`.

### `tests` — access tests

```bash
# action test (--type ACTION_ACCESS is the default)
arkveil tests create --parent <id> --name <n> --status DRAFT \
  [--selector-type ACTION_SET|FORMULA|ALL_ACTIONS] --expected-access GRANTED|DENIED \
  [--action-code <code> ...] [--formula <dsl>] \
  [--user '<json>'] [--context '<json>'] [--request '<json>'] [--tag <slug> ...] \
  [--must-be-granted-by <policyId> ...]

# dataset test
arkveil tests create --parent <id> --name <n> --status ENABLED \
  --type DATASET_READ|DATASET_WRITE --dataset-code <datasource.schema.table> \
  [--user '<json>'] [--context '<json>'] \
  --fixtures '<rows json>' [--expected-pk <pk> ...]

# or hand the whole specification over
arkveil tests create --parent <id> --name <n> --status ENABLED --spec @spec.json

arkveil tests update <testNodeId> --name <n> --status <s> [...]
arkveil tests set-status <testNodeId> --status ENABLED
arkveil tests delete <testNodeId> [--yes]
arkveil tests run <testId>          # takes the test's node id or its resource id
arkveil tests run-all
arkveil tests history [testId]      # per-test runs, or aggregate when no id given
                                    # (resource id only — history keys on the resource)
arkveil tests run-info <runId>      # a single run with per-subject results
```

A test body is root metadata plus **one polymorphic `specification`** — the
flat action-test fields are gone, for action tests too. `--type` picks the
specification; flags belonging to the other kinds are rejected rather than
silently ignored.

Dataset tests (`DATASET_READ` / `DATASET_WRITE`) carry the fixture rows the run
evaluates against:

```bash
arkveil tests create --parent <folderId> --name "Regional user sees own region" \
  --status ENABLED --type DATASET_READ \
  --dataset-code demo_billing.public.invoice \
  --user '{"region":"EU"}' \
  --fixtures '[{"id":"1","region":"EU"},{"id":"2","region":"US"}]' \
  --expected-pk 1
```

- `--fixtures` takes a row array (or the full `{"<code>": [rows]}` map). The
  fixture map must contain exactly the tested dataset's key; `[]` is a
  legitimate **empty table**, not an omission, and is what you get by omitting
  the flag.
- `--expected-pk` names fixture rows that should be visible (READ) or writable
  (WRITE). Values are canonicalized locally the way the server stores them —
  UUIDs lowercased, LONG normalized (`042` → `42`) — so a re-read never shows a
  phantom diff.
- Dataset scenarios take no `--request`: data policies cannot read `request.*`.
- Saving the test **is** the validation. Editing or deleting a dataset does not
  re-validate stored tests; a stale one fails its next run as `ERROR`, and
  re-saving refreshes it.

Test `name` is the identity (unique per workspace) and there is **no upsert** —
a duplicate create is a plain 400. Read the tree first, then create or update by
node id.

`tests run` accepts **either id**: it tries the node endpoint first and falls
back to the resource one, so an id copied straight out of `trees all` /
`trees tests` runs as-is. An id naming a node of another kind — a folder, an
action — is reported as that rather than retried. `tests history` is the
exception: run history keys on the **resource** id, and a node id will not
resolve there.

A failing dataset result prints the expected/actual pk diff plus
`renderedCondition` — the exact SQL the decision endpoints would serve for that
scenario — and the policies that produced it:

```
billing.public.invoice — pk diff
expected:   1
actual:     1, 2
missing:    (none)
unexpected: 2
condition:  "t"."region" = 'eu'
  applied by
    policy a0f665f7-…  "t"."region" = 'eu'
  not applied
    policy 1c9de4a2-…  (condition false)
```

Add `--verbose` to get the condition and the same per-policy breakdown for
**passing** dataset results too. Dataset decisions are filtration, not grants,
so the trace lists every applying policy rather than a single granting one —
see [`eval explain-dataset`](#eval--explain-access-decisions) for the same view
without a stored test. Runs recorded before the API carried filter traces show
the condition alone.

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
install command and a usage snippet, and the **typing recipe** — which is now a
single command, `arkveil generate typescript` (see below).

### `generate` — generate typed SDK code (TypeScript)

Generates a TypeScript file that types the SDK against **your** project. It reads
the project's permission codes (from the actions tree) and the user/context
attribute JSON Schemas, and writes one file that augments the SDK registries via
`declare module "arkveil"`. This emits **TypeScript only** — there is no codegen
for other languages yet.

```bash
arkveil generate typescript -o src/arkveil.generated.ts   # write a file
arkveil gen ts > src/arkveil.generated.ts                 # alias; or pipe stdout
arkveil generate typescript --include user,context        # skip the codes union
arkveil generate typescript --json                        # { language, include, code, … }
```

The generated file exports `ArkveilCodes`, `ArkveilUserAttributes`, and
`ArkveilContextAttributes`, and augments `ArkveilCodeRegistry`,
`ArkveilUserRegistry`, and `ArkveilContextRegistry`. Import it once (a
side-effect import is enough) and permission codes plus `getUserAttributes`,
`getContextAttributes`, and `checkPermission` are all type-checked. Re-run it
whenever your codes or schemas change. Without `--output`, the TypeScript is
written to stdout; status messages go to stderr, so the stream stays clean.

| Option              | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `--include <items>` | Subset of `codes,user,context` (default: all three).   |
| `-o, --output <f>`  | Write to a file instead of stdout.                     |

### `formula` — formula DSL

```bash
arkveil formula parse --context ACTION_PERMISSION --dsl 'user.role == "admin"'
```

### `eval` — explain access decisions

```bash
arkveil eval explain -a orders:read --user '{"role":"admin"}' [--context '<json>'] [--request '<json>']

arkveil eval explain-dataset -d <datasource.schema.table> [-i READ|WRITE] \
  [--user '<json>'] [--context '<json>'] [--alias t]
```

`explain-dataset` renders a dataset's row-level condition for a set of
attributes without authoring a test, plus the per-policy breakdown of it:

```
dataset:   demo_billing.public.invoice
impact:    READ
condition: "t"."region" = 'eu'
applied by
  policy a0f665f7-…  "t"."region" = 'eu'
not applied
  policy 1c9de4a2-…  (condition false)
```

`condition` is the combined SQL the database would run; each `applied by` line
is one policy's own fragment of it. Data policies **apply** rather than grant,
so there is no "granted by": a policy whose target matched but whose condition
was false lands under `not applied`, and one whose target never matched does not
appear at all. An applying policy with no filter is an all-access one. An
unknown or unpoliced dataset answers `FALSE` (no rows) instead of failing. Add
`--json` for the full trace — the `formula` / `residual` ASTs and node values.

### `abac` — ABAC SDK operations

```bash
arkveil abac check --action-code orders:read [--user '<json>'] [--context '<json>'] [--request '<json>']
arkveil abac read  --dataset-code <code> [--user '<json>'] [--context '<json>'] [--alias t]
arkveil abac write --dataset-code <code> [--user '<json>'] [--context '<json>'] [--id <rowId> ...]
arkveil abac action-data <service> <name>
```

Where you ask matters for dataset-backed permission rules. Against the
**kernel**, a rule containing `exists <dataset> where …` cannot be decided at
all: the answer is `granted: false` with `reason: RUNTIME_REQUIRED`, which the
CLI renders as an explanation rather than a denial. Point `--base-url` at a
**sidecar** with the datasource registered for the real, row-accurate decision;
`reason: DATASOURCE_UNRESOLVED` there means the sidecar's
`arkveil.runtime.datasources.<name>.*` entry is missing or the mirror has not
replicated the datasource yet. Permission rules without dataset references
answer identically on both.

### `admin` — workspace administration

```bash
arkveil admin seed-demo            # create the demo workspace (empty workspace only)
arkveil admin clear [--yes]        # DESTRUCTIVE: clears all authz data, seeds nothing
arkveil admin undo-clear           # restore the last clear, while still empty
arkveil admin reset-demo [--yes]   # DESTRUCTIVE: clear, then seed the demo
```

`clear` hard-deletes every policy, target, dataset, datasource, action, test, tag
and navigation node in the workspace. The DAGs and their root folders, API keys,
users, and the user and context attribute schemas survive. Nothing is seeded
afterwards, so it is the way to start from a blank workspace before applying your
own manifest. It also flushes the workspace's policy caches: a
`permissions/check` issued straight after reflects the clear, with no staleness
window to sleep through.

`undo-clear` puts the last clear back — every entity under its **original id**,
the trees in their previous shape — and is deliberately narrow. It reaches back
exactly one clear, requires the workspace to still be empty, and does not restore
test runs or their results. Anything seeded or authored since the clear closes
the window, as does a second undo; the command then prints which precondition
failed and exits non-zero. That is final, not something to retry. Clearing an
already-empty workspace is a no-op that records nothing, so a defensive clear
cannot eat an existing undo.

`seed-demo` is **create-only and requires an empty workspace**: it builds the
canonical demo — 4 actions, 6 targets, 13 policies, 2 datasets and 14 tests, two
of them dataset tests over `demo_billing.public.invoice` — in one shot, so
`arkveil tests run-all` should report 14 passed. Any live entity or navigation
folder makes it answer `400 Demo seeding requires an empty workspace — clear the
workspace first` and create nothing; that second call is a 400 by design, not a
retryable failure. Nothing auto-seeds either: a fresh workspace stays empty until
this command runs.

`reset-demo` is `clear` followed by `seed-demo`, issued client-side — the server
endpoint is gone. The seed step spends the undo the clear creates, so a reset
cannot be walked back with `undo-clear`; clear on its own if you want that door
left open.

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
arkveil eval explain -a orders:read --user '{"role":"admin"}' --json | jq .granted
```

Errors in `--json` mode are emitted to **stderr** as a JSON object
(`{"error":{"message":…,"hint":…,"exitCode":…}}`) while the process exit code
still reflects the failure category (see [Exit codes](#exit-codes)).

Destructive commands (`delete`, `admin clear`, `admin reset-demo`) prompt for confirmation when
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
