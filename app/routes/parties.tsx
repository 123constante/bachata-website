import { buildSeoForRoute } from "@/lib/seo";
import Parties from "@/pages/Parties";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/parties";

// Framework route for /parties — prerendered to static HTML. The SEO payload is
// the static shell GlobalLayout renders (hero, keyword-rich ListingIntro prose,
// breadcrumb JSON-LD) plus the per-page meta below. The EventCalendar inside is
// client-only (it mount-gates itself — its grid/view/citySlug are all SSR-unsafe),
// so no loader/dehydration is needed here.
export const meta: Route.MetaFunction = () => seoInputToMeta(buildSeoForRoute("parties"));

export default function PartiesRoute() {
  return (
    <InitialVisiblePageTransition>
      <Parties />
    </InitialVisiblePageTransition>
  );
}
