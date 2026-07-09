import BachataWeekday, { weekdaySeoInput } from "@/pages/seo/BachataWeekday";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/bachata-weekday";

// ONE module serving all seven weekday landing pages (registered per path in
// app/routes.ts with explicit ids weekday-monday … weekday-sunday):
//   /bachata-london-{monday|tuesday|…|sunday}
// meta() derives the weekday from the pathname via the same helper the page's
// useSeo() uses, so server and client emit identical head tags. The live
// events list stays client-hydrated (day-keyed queries would go stale in the
// daily prerender).
export const meta: Route.MetaFunction = ({ location }) =>
  seoInputToMeta(weekdaySeoInput(location.pathname));

export default function BachataWeekdayRoute() {
  return (
    <InitialVisiblePageTransition>
      <BachataWeekday />
    </InitialVisiblePageTransition>
  );
}
