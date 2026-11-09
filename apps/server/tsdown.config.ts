import { defineConfig } from "tsdown"

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  platform: "node",
  outDir: "./dist",
  clean: true,
  // Workspace packages ship TypeScript source, so they must be bundled in.
  noExternal: [/^@workspace\//],
})
