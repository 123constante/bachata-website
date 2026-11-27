import { buildSeoForRoute } from "@/lib/seo";
import AllProfiles from "@/pages/AllProfiles";
import type { MetaFunction } from "react-router";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /all-profiles (site structure S4b-3), behind VITE_ENABLE_PEOPLE_SSR.
// Server head = the same buildSeoForRoute('allProfiles') the page's useSeo uses.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("allProfiles"));

export default function AllProfilesRoute() {
  return (
    <InitialVisiblePageTransition>
      <AllProfiles />
    </InitialVisiblePageTransition>
  );
}
