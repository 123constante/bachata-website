import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Use the automatic JSX runtime (matches the app's tsconfig `jsx: react-jsx`)
  // so .tsx tests don't need an explicit `import React`. Not the react plugin —
  // just esbuild's JSX mode.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
