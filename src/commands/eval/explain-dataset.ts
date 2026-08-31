import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import { renderFiltration } from "../_filtration.js";
import type {
  DataOperation,
  ExplainDatasetRequest,
  ExplainDatasetResultDTO,
} from "../../lib/types.js";

export interface ExplainDatasetOptions {
  datasetCode: string;
  operation: DataOperation;
  user?: string;
  context?: string;
  alias?: string;
}

/**
 * Explain the per-phase conditions of a data operation for given attributes,
 * without authoring a test (POST /evaluations/explain-dataset). An unknown or
 * unpoliced dataset answers `FALSE` conditions rather than erroring.
 */
export async function explainDataset(
  ctx: CliContext,
  options: ExplainDatasetOptions,
): Promise<void> {
  const body: ExplainDatasetRequest = {
    datasetCode: options.datasetCode,
    operation: options.operation,
    userAttributes: parseJsonObjectFlag(options.user, "--user") ?? {},
    contextAttributes: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.alias !== undefined ? { alias: options.alias } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Explaining ${options.operation} on ${options.datasetCode}…`);
  let result: ExplainDatasetResultDTO;
  try {
    result = await unwrap(client.POST("/api/v1/evaluations/explain-dataset", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not explain the dataset.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    // One condition per phase the operation has; a phase the operation lacks
    // is absent from the response and stays absent here — never empty SQL.
    const conditions: Array<[string, string | undefined]> = [
      ["read condition", result.readCondition],
      ["touch condition", result.touchCondition],
      ["result condition", result.resultCondition],
    ];
    const lines = [
      o.keyValue([
        ["dataset", result.datasetCode],
        ["operation", result.operation],
        ...conditions.filter((entry): entry is [string, string] => entry[1] !== undefined),
      ]),
    ];
    const trace = renderFiltration(o, result.filtrationDetails);
    if (trace.length > 0) lines.push(...trace);
    else lines.push(o.c.dim("(no filtration policies applied)"));
    return lines.join("\n");
  });
}
