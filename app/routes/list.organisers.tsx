import type { MetaFunction } from "react-router";
import Organisers from "@/pages/Organisers";
import { buildSeoForRoute } from "@/lib/seo";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /organisers (site structure S4b-2): server HTML carries the
// title/canonical/description + h1. Same input the page's useSeo() builds for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute('organisers', { cityDisplay: 'London' }));

export default function OrganisersRoute() {
  return (
    <InitialVisiblePageTransition>
      <Organisers />
    </InitialVisiblePageTransition>
  );
}
