import BachataInLondon, { SEO_INPUT } from "@/pages/seo/BachataInLondon";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/london-bachata-guide";

// Framework route for /london-bachata-guide (pillar page) — prerendered so
// crawlers get the full guide HTML (Article + FAQPage JSON-LD, h1, canonical)
// instead of the catchall's generic shell. The live "this week" section stays
// client-hydrated (its day-keyed queries would go stale in the daily prerender).
export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

export default function LondonBachataGuideRoute() {
  return (
    <InitialVisiblePageTransition>
      <BachataInLondon />
    </InitialVisiblePageTransition>
  );
}
