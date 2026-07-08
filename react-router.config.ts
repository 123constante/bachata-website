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
  // Prerender only the listing routes that carry NO server-fetched content
  // (/parties, /classes — their EventCalendar is client-only/mount-gated), so a
  // static shell + meta() is the whole SEO payload and nothing server-rendered
  // can go stale. /city/:slug (the homepage) and /festivals DO dehydrate live
  // content in their loaders, so they moved to on-demand SSR + tagged ISR
  // (taggedData + headers()=cacheHeaders) — edge-cached and purgeable on content
  // change via /api/revalidate. Build-time prerender froze them at deploy time
  // with no revalidation path (stale covers/cancellations until the next deploy);
  // ISR fixes that. Detail routes + the catchall are on-demand SSR too.
  async prerender() {
    return ["/parties", "/classes"];
  },
} satisfies Config;
