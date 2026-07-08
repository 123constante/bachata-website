import { type RouteConfig, route, index } from "@react-router/dev/routes";

// SPIKE routes. Hour-1 shape = catchall only (hosts the legacy declarative
// AnimatedRoutes tree). event/:id + organisers/:id framework routes get added
// once the catchall is proven under `react-router dev`. Dynamic segments
// outrank the "*" splat in RR7 ranking, so those two win over the catchall
// while the duplicate entries still inside AnimatedRoutes become unreachable
// (fine for the spike; Phase 3 deletes them).
export default [
  // Bare "/" -> server redirect to the city homepage (see routes/index.tsx).
  index("routes/index.tsx"),
  route("event/:id", "routes/event.tsx"),
  route("organisers/:id", "routes/organiser.tsx"),
  // Static listing routes — real framework routes (outrank the catchall's
  // duplicate declarative entries) so they can be prerendered to static HTML
  // with real content. See react-router.config.ts `prerender`.
  route("festivals", "routes/festivals.tsx"),
  route("parties", "routes/parties.tsx"),
  route("classes", "routes/classes.tsx"),
  route("city/:slug", "routes/home.tsx"),
  // Detail routes — on-demand SSR loaders (not prerendered; dynamic entities).
  route("dancers/:id", "routes/dancers.tsx"),
  route("djs/:id", "routes/djs.tsx"),
  route("teachers/:id", "routes/teachers.tsx"),
  route("festival/:id", "routes/festival.tsx"),
  // /vendors/:id stays on the catchall (client-only) until a public vendor exists
  // to verify the SSR happy path — the public RPC returns 0 rows for every current
  // vendor, so a framework loader would 404 them all.
  route("venue-entity/:id", "routes/venue-entity.tsx"),
  // SEO landing pages -- framework routes so prerender emits real HTML
  // (canonical/meta/JSON-LD/h1) instead of the catchall's generic shell.
  // The style/weekday modules are shared across paths, so each registration
  // needs an explicit unique id.
  route("faq", "routes/faq.tsx"),
  route("london-bachata-guide", "routes/london-bachata-guide.tsx"),
  route("learn-bachata-london", "routes/learn-bachata-london.tsx"),
  route("bachata-parties-london", "routes/bachata-parties-london.tsx"),
  route("bachata-london-sensual-parties", "routes/bachata-style-parties.tsx", { id: "style-sensual" }),
  route("bachata-london-dominican-parties", "routes/bachata-style-parties.tsx", { id: "style-dominican" }),
  route("bachata-london-monday", "routes/bachata-weekday.tsx", { id: "weekday-monday" }),
  route("bachata-london-tuesday", "routes/bachata-weekday.tsx", { id: "weekday-tuesday" }),
  route("bachata-london-wednesday", "routes/bachata-weekday.tsx", { id: "weekday-wednesday" }),
  route("bachata-london-thursday", "routes/bachata-weekday.tsx", { id: "weekday-thursday" }),
  route("bachata-london-friday", "routes/bachata-weekday.tsx", { id: "weekday-friday" }),
  route("bachata-london-saturday", "routes/bachata-weekday.tsx", { id: "weekday-saturday" }),
  route("bachata-london-sunday", "routes/bachata-weekday.tsx", { id: "weekday-sunday" }),
  // Resource routes (loader/action-only, no component). Framework routes
  // rather than /api/*.ts functions because the preset + Build Output API
  // doesn't route the top-level /api functions.
  route("api/revalidate", "routes/api.revalidate.tsx"),
  route("api/ics/calendar", "routes/api.ics.calendar.tsx"),
  route("api/embed/calendar", "routes/api.embed.calendar.tsx"),
  route("api/og/card", "routes/api.og.card.tsx"),
  route("api/og/bake", "routes/api.og.bake.tsx"),
  route("*", "routes/catchall.tsx"),
] satisfies RouteConfig;
