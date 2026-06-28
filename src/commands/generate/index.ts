import { type Command } from "commander";
import { run } from "../../lib/run.js";
import { generateTypeScript, type GenerateTsOptions } from "./typescript.js";

export function registerGenerate(program: Command): void {
  const generate = program
    .command("generate")
    .alias("gen")
    .description("Generate typed SDK code from this project (TypeScript)");

  generate
    .command("typescript")
    .alias("ts")
    .description("Generate a TypeScript file that types the Arkveil SDK")
    .option(
      "--include <items>",
      "comma-separated subset of codes,user,context",
      "codes,user,context",
    )
    .option("-o, --output <file>", "write to a file instead of stdout")
    .addHelpText(
      "after",
      `
Generates TypeScript that types the Arkveil SDK by declaration-merging into the
\`arkveil\` package: a permission-code union (ArkveilCodes) and \`user\` /
\`context\` attribute types (ArkveilUserAttributes / ArkveilContextAttributes),
sourced from this project's actions and attribute schemas. Import the file once
(a side-effect import is enough) and the SDK becomes typed.

This emits TypeScript only — there is no codegen for other languages yet.

Examples:
  $ arkveil generate typescript -o src/arkveil.generated.ts
  $ arkveil gen ts --include user,context > src/arkveil.generated.ts
  $ arkveil generate typescript --json        # { language, include, code, … }
`,
    )
    .action(async (options: GenerateTsOptions, command: Command) => {
      await run(command, (ctx) => generateTypeScript(ctx, options));
    });
}
