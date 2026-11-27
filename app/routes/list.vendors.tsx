import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import Vendors from "@/pages/Vendors";
import { buildSeoForRoute } from "@/lib/seo";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import type { PeopleRow } from "../lib/peopleListRows";
import { loadVendorRows } from "../lib/peopleListRows.trade";
import ServerPeopleList, { useHydrated } from "../components/ServerPeopleList";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /vendors (site structure S4b-2/S4b-4c): server HTML carries the
// title/canonical/description + a list of real profile links; the client page replaces
// it after hydration. Same input the page's useSeo() builds for London.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute('vendors'));

export const loader = withSsrLoaderTimeout("vendors-list-loader", async function loaderImpl(_args: LoaderFunctionArgs) {
  const rows = await loadVendorRows();
  return taggedData({ rows }, stampSeoLanding());
});

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return cacheHeaders(loaderHeaders);
}

export default function VendorsRoute() {
  const { rows } = useLoaderData() as { rows: PeopleRow[] };
  const hydrated = useHydrated();
  return (
    <InitialVisiblePageTransition>
      {hydrated ? <Vendors /> : <ServerPeopleList heading="Bachata vendors" rows={rows} />}
    </InitialVisiblePageTransition>
  );
}
