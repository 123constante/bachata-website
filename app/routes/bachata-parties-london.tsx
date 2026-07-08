import BachataPartiesLondon, { SEO_INPUT } from "@/pages/seo/BachataPartiesLondon";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/bachata-parties-london";

// Framework route for /bachata-parties-london (parties pillar) — prerendered so
// crawlers get the full HTML (h1, canonical, meta) instead of the catchall's
// generic shell.
export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

export default function BachataPartiesLondonRoute() {
  return (
    <InitialVisiblePageTransition>
      <BachataPartiesLondon />
    </InitialVisiblePageTransition>
  );
}
