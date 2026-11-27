import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import Organisers from "@/pages/Organisers";
import { buildSeoForRoute } from "@/lib/seo";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import type { PeopleRow } from "../lib/peopleListRows";
import { loadOrganiserRows } from "../lib/peopleListRows.places";
import ServerPeopleList, { useHydrated } from "../components/ServerPeopleList";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /organisers (site structure S4b-4b), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
// Before hydration the server list carries real profile links; after hydration
// the real client page replaces it (same gate as routes/tonight.tsx).
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute('organisers', { cityDisplay: 'London' }));

export const loader = withSsrLoaderTimeout("organisers-list-loader", async function loaderImpl(_args: LoaderFunctionArgs) {
  const rows = await loadOrganiserRows();
  return taggedData({ rows }, stampSeoLanding());
});

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return cacheHeaders(loaderHeaders);
}

export default function OrganisersListRoute() {
  const { rows } = useLoaderData() as { rows: PeopleRow[] };
  const hydrated = useHydrated();
  return (
    <InitialVisiblePageTransition>
      {hydrated ? <Organisers /> : <ServerPeopleList heading="Bachata organisers in London" rows={rows} />}
    </InitialVisiblePageTransition>
  );
}
