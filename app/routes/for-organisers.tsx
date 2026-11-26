import ForOrganisers, { SEO_INPUT } from "@/pages/ForOrganisers";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/for-organisers";

// Framework route for /for-organisers (site structure S3c-2) — prerendered so
// crawlers get the page-specific title/canonical/description + h1. meta() below
// is SEO_INPUT's only consumer.
export const meta: Route.MetaFunction = () => seoInputToMeta(SEO_INPUT);

export default function ForOrganisersRoute() {
  return (
    <InitialVisiblePageTransition>
      <ForOrganisers />
    </InitialVisiblePageTransition>
  );
}
