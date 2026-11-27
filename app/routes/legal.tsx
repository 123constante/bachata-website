import Privacy, { PRIVACY_SEO } from "@/pages/Privacy";
import Terms, { TERMS_SEO } from "@/pages/Terms";
import { SITE_ORIGIN } from "@/lib/seo";
import { useLocation, type MetaFunction } from "react-router";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// ONE framework route module for /privacy and /terms (site structure S5a),
// registered twice in app/routes.ts (ids legal-privacy, legal-terms) behind
// VITE_ENABLE_SITE_HEADS_SSR. meta() and the page both pick by pathname.
const isTerms = (pathname: string) => pathname.replace(/\/+$/, "") === "/terms";

export const meta: MetaFunction = ({ location }) =>
  isTerms(location.pathname)
    ? seoInputToMeta({ ...TERMS_SEO, canonical: `${SITE_ORIGIN}/terms` })
    : seoInputToMeta({ ...PRIVACY_SEO, canonical: `${SITE_ORIGIN}/privacy` });

export default function LegalRoute() {
  const { pathname } = useLocation();
  return (
    <InitialVisiblePageTransition>{isTerms(pathname) ? <Terms /> : <Privacy />}</InitialVisiblePageTransition>
  );
}
