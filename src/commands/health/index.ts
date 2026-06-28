import type { Command } from "commander";
import { run } from "../../lib/run.js";
import { unwrap } from "../../lib/api-client.js";

export function registerHealth(program: Command): void {
  program
    .command("health")
    .description("Check API connectivity and report server health")
    .action(async (_options: unknown, command: Command) => {
      await run(command, async (ctx) => {
        const client = await ctx.getClient();
        const spinner = ctx.out.spinner("Checking API health…");
        try {
          const health = await unwrap(client.GET("/api/v1/health"), "GET");
          spinner.succeed("API is reachable.");
          ctx.out.data(health, (o) => {
            const record = (health ?? {}) as Record<string, unknown>;
            const entries = Object.entries(record).map(
              ([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as [string, string],
            );
            return entries.length > 0 ? o.keyValue(entries) : o.c.green("status: ok");
          });
        } catch (err) {
          spinner.fail("API health check failed.");
          throw err;
        }
      });
    });
}
