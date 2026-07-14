import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { applyManifest, type ApplyOptions } from "./apply.js";

export function registerApply(program: Command): void {
  program
    .command("apply")
    .description("Apply a declarative data manifest (datasources + datasets)")
    .requiredOption("--file <json>", "manifest: inline JSON, @file, or -")
    .option("--dry-run", "print the plan without making any changes")
    .option("--prune", "delete server datasets not in the manifest (scoped to declared datasources)")
    .option("-y, --yes", "skip the confirmation prompt for --prune deletions")
    .addHelpText(
      "after",
      `
Manifest shape:
  {
    "datasources": [
      {
        "name": "billing", "dialect": "POSTGRES", "description": "…",
        "datasets": [
          { "dbSchema": "public", "tableName": "invoices", "title": "Invoices",
            "pkName": "id", "pkType": "UUID", "entitySchema": { … } }
        ]
      }
    ]
  }

Semantics:
  - The current state is read first; each entry becomes a create, an update, or
    a no-op (names and schema/table segments compare case-insensitively, the way
    the server canonicalizes them).
  - Identity is immutable (datasource name, dataset dbSchema/tableName): changing
    it shows up as a create of the new identity — add --prune to delete the old.
  - entitySchema is always applied in full: a dataset declared without one is
    applied with an EMPTY schema (the server treats {} as "clear"). A schema
    change that invalidates attached policies fails atomically with the policy
    ids in the error; nothing is applied in that case.
  - Datasource descriptions omitted from the manifest are left unchanged.

Examples:
  $ arkveil apply --file @data.json --dry-run
  $ arkveil apply --file @data.json --prune
  $ cat data.json | arkveil apply --file -
`,
    )
    .action(async (options: ApplyOptions, command: Command) => {
      await run(command, (ctx) => applyManifest(ctx, options));
    });
}
