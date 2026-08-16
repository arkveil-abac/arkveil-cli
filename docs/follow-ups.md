# Follow-ups — rough edges to revisit

Collected while building and live-verifying the docs walkthroughs (2026-08-15/16). None of these
block anything; each is a small UX or hygiene item with a concrete fix direction.

## 1. `--parent` should default to the tree root

`targets create` and `tests create` require `--parent <folderId>`, and the only way to learn a
root folder id is `trees <tree> --json` plus extracting `root.id` — the rendered tree output never
prints root ids. Agents figure this out; humans stumble. Default the parent to the root folder of
the matching tree (one extra GET when the flag is omitted), keep `--parent` for placing things in
subfolders.

## 2. `policies update` demands `--status` for any edit

Changing only a policy's condition fails with `required option '--status <status>' not specified`.
If the kernel PUT replaces the whole policy, the CLI could fetch-and-merge so single-flag updates
work; alternatively the kernel could accept partial updates. Either way, restating unrelated
fields to change one is a papercut — and agents editing policies will hit it constantly.

## 3. Workspace API key statuses are undocumented

`keys create` returns the key with `status: PENDING`, which flips to `ACTIVE` on first use.
Nothing in the help or docs explains the lifecycle, so `PENDING` at creation time reads as
"something is wrong". Document it in `keys` help and the CLI docs — or create keys as `ACTIVE`
if `PENDING` carries no real meaning.

## 4. Dev builds cannot reach the OS keychain

pnpm v10 skips `keytar`'s build script (not whitelisted in `onlyBuiltDependencies`), so a
from-source build can only say "Credentials are stored in the OS keychain but keytar is
unavailable" — a dead end unless `ARKVEIL_TOKEN` is exported. Whitelist keytar for contributor
setups, and make the error message point at the `ARKVEIL_TOKEN` escape hatch.

## 5. operationId `fetchNavigationForest` outlived the `trees forest` rename

The kernel's OpenAPI still names `GET /api/v1/navigation/trees` as `fetchNavigationForest`
(present in the regenerated schema as of 2026-08-16). Kernel-side rename to e.g.
`fetchAllNavigationTrees`, then `pnpm run gen:api` here. Cosmetic only — nothing in this repo
depends on the name.
