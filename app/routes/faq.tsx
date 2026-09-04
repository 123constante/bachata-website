import Faq, { SEO_INPUT } from "@/pages/seo/Faq";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/faq";

// Framework route for /faq — prerendered to static HTML so crawlers get the
// page-specific title/canonical/description + FAQPage JSON-LD + h1 instead of
// the catchall's generic shell. meta() below is SEO_INPUT's only consumer: the
// page also called useSeo(SEO_INPUT) until arc W22, which no-opped under this
// route's InitialVisiblePageTransition (RouteOwnsHeadContext) and was deleted.
export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

export default function FaqRoute() {
  return (
    <InitialVisiblePageTransition>
      <Faq />
    </InitialVisiblePageTransition>
  );
}
