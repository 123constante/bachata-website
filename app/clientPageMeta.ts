import { buildSeoForRoute, type SeoContext } from "@/lib/seo";
import { cityDisplayFromSlug } from "@/lib/cityDisplayName";
import { seoInputToMeta } from "./seoMeta";

// Server meta for client-rendered pages (site structure S2b).
//
// These pages render on the client only (routes/catchall.tsx, or the ":night"
// route falling back to it for one-segment paths), so before this the server
// HTML carried either root.tsx's site-wide defaults or NO title at all. Google
// read every one of them as the same page.
//
// The values MIRROR each page's own client useSeo(buildSeoForRoute(...)) call,
// same route id and same canonical, so the head does not change after
// hydration. A city path takes its name from the slug, as resolvePageCity
// does; a top-level path has no city on the server and uses London, the
// builder's default. Pure: no loader, so the edge-cache reasoning in
// catchall.tsx still holds.
const TOP_LEVEL: Record<string, string> = {
  "/tonight": "tonight",
  "/discounts": "discounts",
  "/search": "search",
};

const CITY_TAB: Record<string, string> = {
  tonight: "tonight",
  discounts: "discounts",
  search: "search",
  parties: "parties",
  classes: "classes",
  map: "city.map",
  calendar: "home",
};

const CITY_PATH = /^\/city\/([a-z0-9-]+)\/([a-z]+)$/;

/** Meta descriptors for a known client page, or null when the path is not one. */
export function clientPageMeta(pathname: string): Array<Record<string, string>> | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const top = TOP_LEVEL[path];
  if (top) return seoInputToMeta(buildSeoForRoute(top));
  const m = CITY_PATH.exec(path);
  if (!m) return null;
  const [, slug, tab] = m;
  const id = CITY_TAB[tab];
  if (!id) return null;
  const ctx: SeoContext = { cityDisplay: cityDisplayFromSlug(slug) ?? "London", entitySlug: slug };
  // CityMap passes its own path as the canonical; the others use the spec path.
  if (id === "city.map") ctx.canonicalPath = `/city/${slug}/map`;
  return seoInputToMeta(buildSeoForRoute(id, ctx));
}
