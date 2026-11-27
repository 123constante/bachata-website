import { buildSeoForRoute } from "@/lib/seo";
import Videographers from "@/pages/Videographers";
import type { MetaFunction } from "react-router";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /videographers (site structure S4b-3), behind VITE_ENABLE_PEOPLE_SSR.
// Server head = the same buildSeoForRoute('videographers') the page's useSeo uses.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("videographers"));

export default function VideographersRoute() {
  return (
    <InitialVisiblePageTransition>
      <Videographers />
    </InitialVisiblePageTransition>
  );
}
