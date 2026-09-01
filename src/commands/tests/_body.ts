/**
 * Request bodies for `tests create` / `tests update`.
 *
 * The API takes root metadata plus one polymorphic `specification` — the flat
 * action-test fields (selectorType, actionCodes, userAttributes, …) are gone,
 * for action tests too. Flags mirror the specification shape; `--spec` passes a
 * whole specification object through for anything the flags do not cover.
 */
import { readJsonInput, parseJsonObjectFlag, asObject } from "../../lib/input.js";
import { UsageError } from "../../lib/errors.js";
import { canonical } from "../_resolve.js";
import { lintFormula, lintDatasetCode } from "../../lib/formula-lint.js";
import type { CliContext } from "../../lib/context.js";
import type {
  TestBody,
  TestStatus,
  TestSpecification,
  TestSpecificationType,
  ActionSelectorType,
  ActionTestSelector,
  ExpectedAccess,
  WriteOperation,
} from "../../lib/types.js";

/** Shared flags for creating/updating a test. */
export interface TestBodyOptions {
  name: string;
  description?: string;
  tag?: string[];
  status: TestStatus;
  /** Specification kind; defaults to ACTION_ACCESS. */
  type?: TestSpecificationType;
  /** Whole specification as JSON — mutually exclusive with the shape flags. */
  spec?: string;
  // ACTION_ACCESS
  selectorType?: ActionSelectorType;
  actionCode?: string[];
  formula?: string;
  request?: string;
  expectedAccess?: ExpectedAccess;
  mustBeGrantedBy?: string[];
  // DATASET_READ / DATASET_WRITE
  datasetCode?: string;
  fixtures?: string;
  expectedPk?: string[];
  // DATASET_WRITE
  operation?: WriteOperation;
  expectedWritablePk?: string[];
  expectedProduciblePk?: string[];
  // both
  user?: string;
  context?: string;
}

/** Build the request body shared by create and update. */
export async function buildTestBody(ctx: CliContext, options: TestBodyOptions): Promise<TestBody> {
  return {
    name: options.name,
    ...(options.description !== undefined ? { description: options.description } : {}),
    tags: options.tag ?? [],
    status: options.status,
    specification: await buildSpecification(ctx, options),
  };
}

async function buildSpecification(
  ctx: CliContext,
  options: TestBodyOptions,
): Promise<TestSpecification> {
  if (options.spec !== undefined) {
    return parseSpecFlag(await readJsonInput(options.spec, "--spec"));
  }
  const type = options.type ?? "ACTION_ACCESS";
  return type === "ACTION_ACCESS"
    ? buildActionSpecification(ctx, options)
    : buildDatasetSpecification(ctx, type, options);
}

/** Validate a `--spec` payload far enough to fail with a flag-level message. */
function parseSpecFlag(value: unknown): TestSpecification {
  const spec = asObject(value, "--spec");
  const type = spec["type"];
  if (type !== "ACTION_ACCESS" && type !== "DATASET_READ" && type !== "DATASET_WRITE") {
    throw new UsageError(
      `--spec needs a "type" of ACTION_ACCESS, DATASET_READ, or DATASET_WRITE (got ${JSON.stringify(type)}).`,
      "The specification is the object stored in resource.specification; copy its shape from `arkveil trees tests`.",
    );
  }
  return spec as unknown as TestSpecification;
}

function buildActionSpecification(ctx: CliContext, options: TestBodyOptions): TestSpecification {
  rejectFlags(options, "ACTION_ACCESS", [
    ["--dataset-code", options.datasetCode !== undefined],
    ["--fixtures", options.fixtures !== undefined],
    ["--expected-pk", (options.expectedPk?.length ?? 0) > 0],
    ["--operation", options.operation !== undefined],
    ["--expected-writable-pk", options.expectedWritablePk !== undefined],
    ["--expected-producible-pk", options.expectedProduciblePk !== undefined],
  ]);
  if (options.expectedAccess === undefined) {
    throw new UsageError("--expected-access is required for an ACTION_ACCESS test.");
  }

  return {
    type: "ACTION_ACCESS",
    selector: buildSelector(ctx, options),
    scenario: {
      userAttributes: parseJsonObjectFlag(options.user, "--user") ?? {},
      contextAttributes: parseJsonObjectFlag(options.context, "--context") ?? {},
      ...(options.request !== undefined
        ? { requestAttributes: parseJsonObjectFlag(options.request, "--request") ?? {} }
        : {}),
    },
    assertion: {
      expectedAccess: options.expectedAccess,
      ...(options.mustBeGrantedBy && options.mustBeGrantedBy.length > 0
        ? { mustBeGrantedByPolicyIds: options.mustBeGrantedBy }
        : {}),
    },
  };
}

function buildSelector(ctx: CliContext, options: TestBodyOptions): ActionTestSelector {
  const selectorType = options.selectorType ?? "ALL_ACTIONS";
  switch (selectorType) {
    case "ACTION_SET": {
      const actionCodes = options.actionCode ?? [];
      if (actionCodes.length === 0) {
        throw new UsageError("--action-code is required at least once for an ACTION_SET selector.");
      }
      return { type: "ACTION_SET", actionCodes };
    }
    case "FORMULA": {
      if (options.formula === undefined) {
        throw new UsageError("--formula is required for a FORMULA selector.");
      }
      for (const warning of lintFormula(options.formula, "--formula")) ctx.out.warn(warning);
      ctx.out.warn(
        "A FORMULA selector still resolves to every action at run time — formula filtering is not implemented yet.",
      );
      return { type: "FORMULA", formulaDsl: options.formula };
    }
    case "ALL_ACTIONS":
      return { type: "ALL_ACTIONS" };
  }
}

function buildDatasetSpecification(
  ctx: CliContext,
  type: "DATASET_READ" | "DATASET_WRITE",
  options: TestBodyOptions,
): TestSpecification {
  rejectFlags(options, type, [
    ["--selector-type", options.selectorType !== undefined],
    ["--action-code", (options.actionCode?.length ?? 0) > 0],
    ["--formula", options.formula !== undefined],
    ["--expected-access", options.expectedAccess !== undefined],
    ["--must-be-granted-by", (options.mustBeGrantedBy?.length ?? 0) > 0],
    // Data policies cannot reference request.*, so a dataset scenario has no
    // request attributes to carry.
    ["--request", options.request !== undefined],
  ]);
  if (options.datasetCode === undefined) {
    throw new UsageError(`--dataset-code is required for a ${type} test.`);
  }

  const datasetCode = canonical(options.datasetCode);
  for (const warning of lintDatasetCode(datasetCode, "--dataset-code")) ctx.out.warn(warning);

  const scenario = {
    userAttributes: parseJsonObjectFlag(options.user, "--user") ?? {},
    contextAttributes: parseJsonObjectFlag(options.context, "--context") ?? {},
    datasetFixtures: parseFixtures(options.fixtures, datasetCode),
  };

  if (type === "DATASET_READ") {
    rejectFlags(options, type, [
      ["--operation", options.operation !== undefined],
      ["--expected-writable-pk", options.expectedWritablePk !== undefined],
      ["--expected-producible-pk", options.expectedProduciblePk !== undefined],
    ]);
    return {
      type,
      datasetCode,
      scenario,
      assertion: { expectedVisiblePks: (options.expectedPk ?? []).map(canonicalPk) },
    };
  }
  if ((options.expectedPk?.length ?? 0) > 0) {
    throw new UsageError(
      "--expected-pk does not apply to a DATASET_WRITE test.",
      "A write test asserts per check: --expected-writable-pk (TOUCH; UPDATE/DELETE) " +
        "and/or --expected-producible-pk (RESULT; CREATE/UPDATE).",
    );
  }
  if (options.operation === undefined) {
    throw new UsageError("--operation is required for a DATASET_WRITE test (CREATE, UPDATE or DELETE).");
  }
  return {
    type,
    datasetCode,
    operation: options.operation,
    scenario,
    assertion: buildWriteAssertion(options.operation, options),
  };
}

/**
 * One assertion field per check the operation has. For the single-check
 * operations the unused flag means "expect none" (like `--expected-pk` on
 * READ); UPDATE has two possible checks, so each flag asserts its check only
 * when given — spelling an *empty* UPDATE check needs `--spec`.
 */
function buildWriteAssertion(
  operation: WriteOperation,
  options: TestBodyOptions,
): { expectedWritablePks?: string[]; expectedProduciblePks?: string[] } {
  const writable = options.expectedWritablePk?.map(canonicalPk);
  const producible = options.expectedProduciblePk?.map(canonicalPk);

  if (operation === "DELETE") {
    if (producible !== undefined) {
      throw new UsageError(
        "--expected-producible-pk does not apply to a DELETE write test.",
        "DELETE has no RESULT check — it asserts writable only (the TOUCH check).",
      );
    }
    return { expectedWritablePks: writable ?? [] };
  }
  if (operation === "CREATE") {
    if (writable !== undefined) {
      throw new UsageError(
        "--expected-writable-pk does not apply to a CREATE write test.",
        "CREATE has no TOUCH check — it asserts producible only (fixture rows play candidate post-states).",
      );
    }
    return { expectedProduciblePks: producible ?? [] };
  }
  if (writable === undefined && producible === undefined) {
    throw new UsageError(
      "An UPDATE write test asserts at least one check.",
      "Pass --expected-writable-pk (TOUCH) and/or --expected-producible-pk (RESULT).",
    );
  }
  return {
    ...(writable !== undefined ? { expectedWritablePks: writable } : {}),
    ...(producible !== undefined ? { expectedProduciblePks: producible } : {}),
  };
}

/**
 * `--fixtures` is the `datasetFixtures` map keyed by canonical dataset code.
 * The server requires exactly the tested dataset's key, so the common
 * single-dataset case may also be written as a bare row array; `[]` is a
 * legitimate empty table, never an omission.
 */
export function parseFixtures(
  value: string | undefined,
  datasetCode: string,
): Record<string, Record<string, unknown>[]> {
  if (value === undefined) return { [datasetCode]: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new UsageError(
      `--fixtures is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      'Pass a row array, or a { "<dataset code>": [rows] } map.',
    );
  }
  if (Array.isArray(parsed)) return { [datasetCode]: parsed as Record<string, unknown>[] };

  const map = asObject(parsed, "--fixtures");
  const keys = Object.keys(map);
  const foreign = keys.filter((k) => canonical(k) !== datasetCode);
  if (foreign.length > 0) {
    throw new UsageError(
      `--fixtures declares rows for other datasets: ${foreign.join(", ")}.`,
      `A dataset test carries exactly one fixture key — ${datasetCode}. Use [] for an empty table.`,
    );
  }
  const key = keys[0];
  if (key === undefined) return { [datasetCode]: [] };
  return { [datasetCode]: map[key] as Record<string, unknown>[] };
}

/**
 * Expected pks come back canonicalized (UUIDs lowercased, LONG values
 * normalized), so normalize on the way out too — otherwise re-reading a stored
 * test shows a perpetual diff against the input that produced it.
 */
export function canonicalPk(pk: string): string {
  const trimmed = pk.trim();
  if (/^-?\d+$/.test(trimmed)) return String(BigInt(trimmed));
  return trimmed.toLowerCase();
}

function rejectFlags(
  options: TestBodyOptions,
  type: TestSpecificationType,
  flags: [string, boolean][],
): void {
  const offending = flags.filter(([, present]) => present).map(([flag]) => flag);
  if (offending.length > 0) {
    throw new UsageError(
      `${offending.join(", ")} ${offending.length === 1 ? "does" : "do"} not apply to a ${type} test.`,
      `Test "${options.name}" is --type ${type}; drop the flag or change the type.`,
    );
  }
}
