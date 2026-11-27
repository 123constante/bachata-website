import type { MetaFunction } from "react-router";
import DJs from "@/pages/DJs";
import { buildSeoForRoute } from "@/lib/seo";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /djs (site structure S4b-1), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("djs", { cityDisplay: 'London' }));

export default function DJsListRoute() {
  return (
    <InitialVisiblePageTransition>
      <DJs />
    </InitialVisiblePageTransition>
  );
}
