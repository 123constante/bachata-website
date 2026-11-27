import type { MetaFunction } from "react-router";
import Venues from "@/pages/Venues";
import { buildSeoForRoute } from "@/lib/seo";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /venues (site structure S4b-2): server HTML carries the
// title/canonical/description + h1. Same input the page's useSeo() builds for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute('venues', { cityDisplay: 'London' }));

export default function VenuesRoute() {
  return (
    <InitialVisiblePageTransition>
      <Venues />
    </InitialVisiblePageTransition>
  );
}
