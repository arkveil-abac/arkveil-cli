import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";
import { parseJsonObjectFlag } from "../../lib/input.js";
import { renderFiltration } from "../_filtration.js";
import type {
  DatasetImpact,
  ExplainDatasetRequest,
  ExplainDatasetResultDTO,
} from "../../lib/types.js";

export interface ExplainDatasetOptions {
  datasetCode: string;
  impact: DatasetImpact;
  user?: string;
  context?: string;
  alias?: string;
}

/**
 * Explain a dataset's READ/WRITE condition for given attributes, without
 * authoring a test (POST /evaluations/explain-dataset). An unknown or
 * unpoliced dataset answers `renderedCondition: "FALSE"` rather than erroring.
 */
export async function explainDataset(
  ctx: CliContext,
  options: ExplainDatasetOptions,
): Promise<void> {
  const body: ExplainDatasetRequest = {
    datasetCode: options.datasetCode,
    impact: options.impact,
    userAttributes: parseJsonObjectFlag(options.user, "--user") ?? {},
    contextAttributes: parseJsonObjectFlag(options.context, "--context") ?? {},
    ...(options.alias !== undefined ? { alias: options.alias } : {}),
  };

  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Explaining ${options.impact} on ${options.datasetCode}…`);
  let result: ExplainDatasetResultDTO;
  try {
    result = await unwrap(client.POST("/api/v1/evaluations/explain-dataset", { body }), "POST");
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not explain the dataset.");
    throw err;
  }

  ctx.out.data(result, (o) => {
    const lines = [
      o.keyValue([
        ["dataset", result.datasetCode],
        ["impact", result.impact],
        ["condition", result.renderedCondition],
      ]),
    ];
    const trace = renderFiltration(o, result.filtrationDetails);
    if (trace.length > 0) lines.push(...trace);
    else lines.push(o.c.dim("(no filtration policies applied)"));
    return lines.join("\n");
  });
}
