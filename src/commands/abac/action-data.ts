import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";

/** Fetch resolved action data (GET /api/v1/abac/actions/{service}/{name}/data). */
export async function fetchActionData(ctx: CliContext, service: string, name: string): Promise<void> {
  const client = await ctx.getClient({ requireAuth: true });
  const spinner = ctx.out.spinner(`Fetching data for ${service}:${name}…`);
  let data: unknown;
  try {
    data = await unwrap(
      client.GET("/api/v1/abac/actions/{service}/{name}/data", { params: { path: { service, name } } }),
      "GET",
    );
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch action data.");
    throw err;
  }
  ctx.out.data(data, () => JSON.stringify(data ?? {}, null, 2));
}
