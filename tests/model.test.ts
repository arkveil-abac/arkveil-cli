import { describe, it, expect } from "vitest";
import { buildProgram } from "../src/index.js";

const SUBCOMMANDS = ["all", "tests", "datasources", "data-policies", "actions", "action-policies"];

describe("model command group", () => {
  const program = buildProgram();
  const find = (name: string) => program.commands.find((c) => c.name() === name);

  it("registers `model` with every tree subcommand", () => {
    const model = find("model");
    expect(model).toBeDefined();
    expect(model?.commands.map((c) => c.name())).toEqual(SUBCOMMANDS);
  });

  it("keeps `trees` as a working deprecated spelling with the same subcommands", () => {
    const trees = find("trees");
    expect(trees).toBeDefined();
    expect(trees?.description()).toContain("Deprecated");
    expect(trees?.commands.map((c) => c.name())).toEqual(SUBCOMMANDS);
  });

  it("lists `model` in help and hides `trees`", () => {
    const visible = program
      .createHelp()
      .visibleCommands(program)
      .map((c) => c.name());
    expect(visible).toContain("model");
    expect(visible).not.toContain("trees");
  });
});
