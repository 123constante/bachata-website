import LearnBachataLondon, { SEO_INPUT } from "@/pages/seo/LearnBachataLondon";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/learn-bachata-london";

// Framework route for /learn-bachata-london (beginner pillar) — prerendered so
// crawlers get the full HTML (Article + FAQPage JSON-LD, h1, canonical) instead
// of the catchall's generic shell. Live beginner-classes section stays
// client-hydrated.
export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

export default function LearnBachataLondonRoute() {
  return (
    <InitialVisiblePageTransition>
      <LearnBachataLondon />
    </InitialVisiblePageTransition>
  );
}
