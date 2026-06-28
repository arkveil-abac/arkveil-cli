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
  // All runtime deps live in devDependencies so they get bundled here, producing
  // a self-contained dist/index.js that runs with no node_modules (see install.sh).
  // keytar is the exception: it's an optional native module loaded dynamically at
  // runtime, so it must stay external and absent installs fall back to file storage.
  external: ["keytar"],
  banner: {
    // Bundled CommonJS deps (e.g. commander) call require() for Node built-ins.
    // ESM output has no require, so esbuild's shim throws "Dynamic require of ...".
    // Inject a real require via createRequire so those resolve at runtime.
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});
