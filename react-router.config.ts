import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

// SPIKE (branch spike/rr7-framework-mode) — RR7 framework mode go/no-go probe.
// appDirectory 'app' keeps spike files out of scripts/lint-runtime-architecture.mjs's
// src/** scan and leaves src/main.tsx / src/entry-client.tsx untouched (dead on this
// branch). ssr:true renders every route on the server (the catchall client-gates the
// legacy declarative tree — see app/routes/catchall.tsx).
export default {
  appDirectory: "app",
  ssr: true,
  presets: [vercelPreset()],
} satisfies Config;
