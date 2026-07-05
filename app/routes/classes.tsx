import { buildSeoForRoute } from "@/lib/seo";
import Classes from "@/pages/Classes";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/classes";

// Framework route for /classes — prerendered to static HTML. See routes/parties.tsx:
// the static GlobalLayout shell (hero, ListingIntro prose, breadcrumbs) + meta() are
// the SSR SEO payload; the EventCalendar is client-only (mount-gated).
export const meta: Route.MetaFunction = () => seoInputToMeta(buildSeoForRoute("classes"));

export default function ClassesRoute() {
  return (
    <InitialVisiblePageTransition>
      <Classes />
    </InitialVisiblePageTransition>
  );
}
