import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  // The catalog package ships TypeScript source so both storefronts can share
  // one definition. Bundle it into the server artifact.
  noExternal: ["@repo/catalog"],
});
