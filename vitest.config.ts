import { defineConfig } from "vitest/config";
import path from "path";
import { fileBytesPlugin } from "./vite.fileBytes";

export default defineConfig({
  // Same `?bytes` loader the build uses (vite.fileBytes.ts), so OG font tests
  // decode exactly what the server bundle ships.
  plugins: [fileBytesPlugin()],
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
    // 20s per test / hook, up from the 5s default. Issue #1572: JoinGetPaidNext, reviewScope and
    // ogWholeFlyerCard pass alone but time out in the pre-push gate when the machine is loaded
    // (slow imports plus git spawns land on the 5s budget). Same fix and reasoning as the admin repo.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
  },
});
