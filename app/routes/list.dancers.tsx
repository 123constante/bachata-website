import type { MetaFunction } from "react-router";
import Dancers from "@/pages/Dancers";
import { buildSeoForRoute } from "@/lib/seo";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /dancers (site structure S4b-1), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("dancers", { cityDisplay: 'London' }));

export default function DancersListRoute() {
  return (
    <InitialVisiblePageTransition>
      <Dancers />
    </InitialVisiblePageTransition>
  );
}
