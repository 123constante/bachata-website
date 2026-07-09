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
    // /parties + /classes carry no server-fetched content (see comment above).
    // The 13 SEO landing pages are the same shape -- no loaders, static content
    // + a client-hydrated live-events section -- so a static shell with per-page
    // meta()/JSON-LD is the whole SEO payload and nothing server-rendered can go
    // stale; the daily redeploy cron refreshes them. /city/:slug (homepage) and
    // /festivals stay OFF this list -- they dehydrate live content and moved to
    // on-demand SSR + tagged ISR (see comment above).
    return [
      "/parties",
      "/classes",
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
