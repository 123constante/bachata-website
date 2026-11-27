import type { MetaFunction } from "react-router";
import Vendors from "@/pages/Vendors";
import { buildSeoForRoute } from "@/lib/seo";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /vendors (site structure S4b-2): server HTML carries the
// title/canonical/description + h1. Same input the page's useSeo() builds for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute('vendors'));

export default function VendorsRoute() {
  return (
    <InitialVisiblePageTransition>
      <Vendors />
    </InitialVisiblePageTransition>
  );
}
