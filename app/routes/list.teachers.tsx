import type { MetaFunction } from "react-router";
import Teachers from "@/pages/Teachers";
import { buildSeoForRoute } from "@/lib/seo";
import { DEFAULT_TEACHERS_SEO } from "@/modules/teachers-directory/teachersCity";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /teachers (site structure S4b-1), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("teachers", DEFAULT_TEACHERS_SEO));

export default function TeachersListRoute() {
  return (
    <InitialVisiblePageTransition>
      <Teachers />
    </InitialVisiblePageTransition>
  );
}
