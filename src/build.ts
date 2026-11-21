import { build } from "esbuild";
import { buildConfig } from "./build-config";

// COMMONJS
build({
  entryPoints: { "index.cjs": "src/builds/module.ts" },
  bundle: true,
  minify: true,
  logLevel: "info",
  outfile: "dist/index.cjs",
  format: "cjs",
  ...buildConfig,
});

// MODULE
build({
  entryPoints: { "index.mjs": "src/builds/module.ts" },
  bundle: true,
  minify: true,
  logLevel: "info",
  outfile: "dist/index.mjs",
  format: "esm",
  ...buildConfig,
});

// CDN
build({
  entryPoints: { "cdn.min": "src/builds/cdn.ts" },
  bundle: true,
  minify: true,
  logLevel: "info",
  outdir: "dist",
  format: "iife",
  ...buildConfig,
});
