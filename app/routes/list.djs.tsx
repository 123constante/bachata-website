import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import DJs from "@/pages/DJs";
import { buildSeoForRoute } from "@/lib/seo";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import { loadDjRows, type PeopleRow } from "../lib/peopleListRows";
import ServerPeopleList, { useHydrated } from "../components/ServerPeopleList";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /djs (site structure S4b-1/S4b-4a), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
// Before hydration the server list carries real profile links; after hydration
// the real client page replaces it (same gate as routes/tonight.tsx).
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("djs", { cityDisplay: 'London' }));

export const loader = withSsrLoaderTimeout("djs-list-loader", async function loaderImpl(_args: LoaderFunctionArgs) {
  const rows = await loadDjRows();
  return taggedData({ rows }, stampSeoLanding());
});

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return cacheHeaders(loaderHeaders);
}

export default function DJsListRoute() {
  const { rows } = useLoaderData() as { rows: PeopleRow[] };
  const hydrated = useHydrated();
  return (
    <InitialVisiblePageTransition>
      {hydrated ? <DJs /> : <ServerPeopleList heading="Bachata DJs in London" rows={rows} />}
    </InitialVisiblePageTransition>
  );
}
