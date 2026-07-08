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
  // Prerender the static listing/home routes to HTML at build time (Q3 — Ricky
  // chose "keep prerender for home/listings"). These routes have real framework
  // modules with loaders that dehydrate their content queries, so the emitted
  // HTML is content-rich (not the empty shell the client-gated catchall would
  // produce). Detail routes + the catchall stay on-demand SSR. Dynamic-param
  // routes (e.g. /city/:slug) are enumerated explicitly.
  async prerender() {
    // /city/london-gb is the homepage (bare '/' and '/london-gb' redirect here
    // via vercel.json). More cities can be added as they warrant static SEO.
    return [
      "/festivals",
      "/parties",
      "/classes",
      "/city/london-gb",
      // SEO landing pages (framework routes in app/routes.ts) -- the daily
      // redeploy cron keeps their prerendered HTML fresh.
      "/faq",
      "/london-bachata-guide",
      "/learn-bachata-london",
      "/bachata-parties-london",
      "/bachata-london-sensual-parties",
      "/bachata-london-dominican-parties",
      "/bachata-london-monday",
      "/bachata-london-tuesday",
      "/bachata-london-wednesday",
      "/bachata-london-thursday",
      "/bachata-london-friday",
      "/bachata-london-saturday",
      "/bachata-london-sunday",
    ];
  },
} satisfies Config;
