import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import Teachers from "@/pages/Teachers";
import { buildSeoForRoute } from "@/lib/seo";
import { DEFAULT_TEACHERS_SEO } from "@/modules/teachers-directory/teachersCity";
import { stampSeoLanding } from "../cacheTags";
import { cacheHeaders, taggedData } from "../detailLoader";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { withSsrLoaderTimeout } from "../lib/ssrLoaderTimeout";
import type { PeopleRow } from "../lib/peopleListRows";
import { loadTeacherRows } from "../lib/peopleListRows.trade";
import ServerPeopleList, { useHydrated } from "../components/ServerPeopleList";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /teachers (site structure S4b-1/S4b-4c), registered only behind
// VITE_ENABLE_PEOPLE_SSR. Server head matches the page's client useSeo for London.
// Before hydration the server list carries real profile links; after hydration
// the real client page replaces it.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("teachers", DEFAULT_TEACHERS_SEO));

export const loader = withSsrLoaderTimeout("teachers-list-loader", async function loaderImpl(_args: LoaderFunctionArgs) {
  const rows = await loadTeacherRows();
  return taggedData({ rows }, stampSeoLanding());
});

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return cacheHeaders(loaderHeaders);
}

export default function TeachersListRoute() {
  const { rows } = useLoaderData() as { rows: PeopleRow[] };
  const hydrated = useHydrated();
  return (
    <InitialVisiblePageTransition>
      {hydrated ? <Teachers /> : <ServerPeopleList heading="Bachata teachers in London" rows={rows} />}
    </InitialVisiblePageTransition>
  );
}
