import BachataStyleParties, { styleSeoInput } from "@/pages/seo/BachataStyleParties";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/bachata-style-parties";

// ONE module serving BOTH style-split landing pages (registered twice in
// app/routes.ts with explicit ids style-sensual / style-dominican):
//   /bachata-london-sensual-parties and /bachata-london-dominican-parties
// meta() derives the style from the pathname via the same helper the page's
// useSeo() uses, so server and client emit identical head tags.
export const meta: Route.MetaFunction = ({ location }) =>
  seoInputToMeta(styleSeoInput(location.pathname));

export default function BachataStylePartiesRoute() {
  return (
    <InitialVisiblePageTransition>
      <BachataStyleParties />
    </InitialVisiblePageTransition>
  );
}
