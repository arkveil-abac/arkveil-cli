import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  splitting: false,
  // keytar is an optional native dependency loaded dynamically at runtime;
  // never bundle it so installs without it still work.
  external: ["keytar"],
  banner: {
    // Allow `import.meta`/dynamic requires to resolve cleanly when published.
    js: "",
  },
});
