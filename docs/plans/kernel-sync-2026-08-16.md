# Plan: sync the CLI with the 2026-08-16 kernel changes

Work on branch `rename-trees-all` and push to it — it backs the open PR
https://github.com/arkveil-abac/arkveil-cli/pull/2. Version stays 1.5.0 (unreleased).

The backend contract is `../backend/docs/engineering/cli-2026-08-16-changes.md` — read it first,
it is self-contained and normative. This plan only adds the CLI-side decisions.

## 1. Regenerate the API types

`pnpm run gen:api`. The spec gains `runTestByNode` (`POST /api/v1/navigation/tests/{testNodeId}/run`),
`clear` and `undo-clear` admin paths, and loses `wipe` and `reset-demo`.

## 2. `tests run <id>` accepts either id

- Try `POST /api/v1/navigation/tests/{id}/run` first. On **404 or 500** fall back to
  `POST /api/v1/tests/{id}/run` (500 covers kernels that predate the route — an unmapped route
  answers 500 there, so a 404-only fallback would never fire). A **400** means the id names a
  non-test node — report it as-is, never retry. See the contract's status table.
- If the fallback itself 404s, surface that error (`Test not found: <uuid>`), not the first one.
- Help text: replace "takes the test RESOURCE id, not its node id" with "accepts the test's node
  id (as shown in `trees all` / `trees tests`) or its resource id".
- `tests history` still keys on the resource id (run history is unchanged) — do not add resolution
  there, but say "resource id" explicitly in its help.

## 3. Admin commands

- **`wipe` → `clear`** (new path `/admin/workspaces/default/clear`). Keep `-y/--yes` and the
  destructive help text, updating the survivors list per the contract (root folders, API keys,
  users, user/context attribute schemas) and dropping the auto-seed sentence — there is no
  auto-seed any more.
- **`undo-clear`** — new command. Help must state the narrow window: restores the last clear only,
  requires the workspace to still be empty, single-level, test runs and results are not restored.
  A 400 from it means the window closed — render the server message, exit non-zero, no retry hint.
- **`reset-demo`** — keep the command, reimplement client-side as `clear` then `seed-demo`
  (the server endpoint is gone). Keep `-y`. Mention in its help that the reset spends the
  `undo-clear` window.
- **`seed-demo`** — path unchanged, semantics changed. Fix the success message: it currently says
  "(existing entities preserved)", which is no longer true — it creates the canonical demo in one
  shot. Rewrite the help: create-only, requires an empty workspace, a second call answers 400 by
  design (`Demo seeding requires an empty workspace — clear the workspace first`), point to
  `admin clear`. Delete the paragraph about the `invoice` short-reference ambiguity — a required
  empty workspace cannot contain a conflicting user dataset.

## 4. Tests

Vitest with the mocked client, following the existing conventions in `tests/`:

- `tests run`: node id succeeds directly; 404 → fallback succeeds; 500 → fallback succeeds
  (old kernel); 400 → reported without fallback; 404 → fallback 404 → clean "Test not found".
- Admin: `clear` hits the new path and keeps the confirmation gate; `undo-clear` renders the
  precondition messages; `reset-demo` issues clear then seed in order; `seed-demo` shows the new
  success message.

## 5. Docs in this repo

Update README: the admin section (clear / undo-clear / reset-demo semantics, non-idempotent
seed-demo), the `tests run` line, and any leftover claims about auto-seed or old counts.

## 6. Verify live before pushing

The deployed kernel already has all of this. Credentials: `source ~/.arkveil-e2e-env` and pass the
session token, e.g. `ARKVEIL_TOKEN=$ARKVEIL_SESSION node dist/index.js …` (keytar is unavailable in
dev builds, so the keychain path fails — the env token is the way). The default workspace is
disposable demo data: exercise `clear`, `seed-demo` (expect success on empty and the 400 on a
second run), `undo-clear` precondition failures, `tests run` with a node id from `trees all`, and
`run-all` (14 PASSED). Reseed the demo at the end so the workspace is left in the seeded state.

## Done means

Typecheck, tests, and build green. Live checks above pass. Branch pushed to
`origin/rename-trees-all`, with a PR comment on #2 summarizing what was added.
