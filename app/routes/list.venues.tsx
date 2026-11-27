import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import Venues from "@/pages/Venues";
import { buildSeoForRoute } from "@/lib/seo";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import type { PeopleRow } from "../lib/peopleListRows";
import { loadVenueRows } from "../lib/peopleListRows.places";
import ServerPeopleList, { useHydrated } from "../components/ServerPeopleList";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /venues (site structure S4b-4b), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
// Before hydration the server list carries real profile links; after hydration
// the real client page replaces it (same gate as routes/tonight.tsx).
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute('venues', { cityDisplay: 'London' }));

export const loader = withSsrLoaderTimeout("venues-list-loader", async function loaderImpl(_args: LoaderFunctionArgs) {
  const rows = await loadVenueRows();
  return taggedData({ rows }, stampSeoLanding());
});

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return cacheHeaders(loaderHeaders);
}

export default function VenuesListRoute() {
  const { rows } = useLoaderData() as { rows: PeopleRow[] };
  const hydrated = useHydrated();
  return (
    <InitialVisiblePageTransition>
      {hydrated ? <Venues /> : <ServerPeopleList heading="Bachata venues in London" rows={rows} />}
    </InitialVisiblePageTransition>
  );
}
