import { type RouteConfig, route } from "@react-router/dev/routes";

// SPIKE routes. Hour-1 shape = catchall only (hosts the legacy declarative
// AnimatedRoutes tree). event/:id + organisers/:id framework routes get added
// once the catchall is proven under `react-router dev`. Dynamic segments
// outrank the "*" splat in RR7 ranking, so those two win over the catchall
// while the duplicate entries still inside AnimatedRoutes become unreachable
// (fine for the spike; Phase 3 deletes them).
export default [
  route("event/:id", "routes/event.tsx"),
  route("organisers/:id", "routes/organiser.tsx"),
  // Static listing routes — real framework routes (outrank the catchall's
  // duplicate declarative entries) so they can be prerendered to static HTML
  // with real content. See react-router.config.ts `prerender`.
  route("festivals", "routes/festivals.tsx"),
  route("city/:slug", "routes/home.tsx"),
  route("*", "routes/catchall.tsx"),
] satisfies RouteConfig;
