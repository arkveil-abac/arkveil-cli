import type { CliContext } from "../../lib/context.js";
import { unwrap } from "../../lib/api-client.js";

/** Print the working guide for the access model (GET /skill). */
export async function showSkill(ctx: CliContext): Promise<void> {
  const client = await ctx.getClient();
  const spinner = ctx.out.spinner("Fetching the skill…");
  let skill: { content?: string };
  try {
    skill = (await unwrap(client.GET("/api/v1/skill"), "GET")) ?? { content: "" };
    spinner.stop();
  } catch (err) {
    spinner.fail("Could not fetch the skill.");
    throw err;
  }
  ctx.out.data(skill, () => skill.content ?? "");
}
