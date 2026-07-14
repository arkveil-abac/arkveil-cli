/**
 * Declarative manifest for the data namespace: datasources and the datasets
 * nested under them. Parsed with zod, then normalized the way the server
 * canonicalizes identifiers (trim + lowercase) so diffing desired vs. actual
 * state never sees case-only differences.
 */
import { z } from "zod";
import { UsageError } from "../../lib/errors.js";
import { canonical } from "../_resolve.js";
import type { DatasourceDialect, PkType } from "../../lib/types.js";

/** Charset the server enforces on datasource names and dataset segments. */
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

const datasetSchema = z
  .object({
    dbSchema: z.string().min(1),
    tableName: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    pkName: z.string().min(1),
    pkType: z.enum(["UUID", "LONG", "STRING"]),
    entitySchema: z.record(z.unknown()).optional(),
  })
  .strict();

const datasourceSchema = z
  .object({
    name: z.string().min(1),
    dialect: z.enum(["POSTGRES", "MYSQL", "MARIADB", "H2"]),
    description: z.string().optional(),
    datasets: z.array(datasetSchema).default([]),
  })
  .strict();

const manifestSchema = z
  .object({
    datasources: z.array(datasourceSchema).default([]),
  })
  .strict();

export interface ManifestDataset {
  /** Canonical (lowercased) identity segment. */
  dbSchema: string;
  /** Canonical (lowercased) identity segment. */
  tableName: string;
  title: string;
  description?: string;
  pkName: string;
  pkType: PkType;
  /**
   * Always present: a manifest-driven update sends the full desired schema
   * object on every update; a dataset declared without one is applied with an
   * empty (cleared) schema.
   */
  entitySchema: Record<string, unknown>;
}

export interface ManifestDatasource {
  /** Canonical (lowercased) name. */
  name: string;
  dialect: DatasourceDialect;
  description?: string;
  datasets: ManifestDataset[];
}

export interface Manifest {
  datasources: ManifestDatasource[];
}

/** Canonical dataset id (`datasource.schema.table`), as the server stores it. */
export function datasetCode(datasourceName: string, dataset: ManifestDataset): string {
  return `${datasourceName}.${dataset.dbSchema}.${dataset.tableName}`;
}

/** Parse, validate, and normalize a manifest JSON value. */
export function parseManifest(value: unknown): Manifest {
  const result = manifestSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new UsageError(`Manifest is invalid:\n${issues}`, "Fix the listed fields and retry.");
  }

  const datasources = result.data.datasources.map((ds, dsIndex) => {
    const name = canonical(ds.name);
    requireIdentifier(name, `datasources[${dsIndex}].name`);
    const datasets = ds.datasets.map((d, dIndex) => {
      const path = `datasources[${dsIndex}].datasets[${dIndex}]`;
      const dbSchema = canonical(d.dbSchema);
      const tableName = canonical(d.tableName);
      requireIdentifier(dbSchema, `${path}.dbSchema`);
      requireIdentifier(tableName, `${path}.tableName`);
      return {
        dbSchema,
        tableName,
        title: d.title,
        ...(d.description !== undefined ? { description: d.description } : {}),
        pkName: d.pkName,
        pkType: d.pkType,
        entitySchema: d.entitySchema ?? {},
      };
    });
    return {
      name,
      dialect: ds.dialect,
      ...(ds.description !== undefined ? { description: ds.description } : {}),
      datasets,
    };
  });

  rejectDuplicates(
    datasources.map((ds) => ds.name),
    (dup) => `Manifest declares datasource "${dup}" more than once.`,
  );
  for (const ds of datasources) {
    rejectDuplicates(
      ds.datasets.map((d) => `${d.dbSchema}.${d.tableName}`),
      (dup) => `Manifest declares dataset "${ds.name}.${dup}" more than once.`,
    );
  }

  return { datasources };
}

function requireIdentifier(value: string, path: string): void {
  if (!IDENTIFIER.test(value)) {
    throw new UsageError(
      `${path} "${value}" is invalid: must match ^[a-z_][a-z0-9_]*$ after lowercasing.`,
    );
  }
}

function rejectDuplicates(values: string[], message: (dup: string) => string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new UsageError(message(value), "Identities are case-insensitive; merge the entries.");
    }
    seen.add(value);
  }
}
