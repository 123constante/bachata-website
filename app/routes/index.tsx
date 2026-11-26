import { useContext } from "react";
import { data as routerData, redirect, UNSAFE_RouteContext } from "react-router";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
import { resolvePublicOrganiserRef } from "@/lib/seo/resolvePublicOrganiserRef";
import { isSubdomainLabel, parseEventHost } from "../lib/eventSubdomain";
import { organiserHostServable, organiserSubdomainOrigin } from "../lib/organiserSubdomain";
import EventRoute, { headers as eventHeaders, loader as eventLoader, meta as eventMeta } from "./event";
import OrganiserRoute, { loader as organiserLoader, meta as organiserMeta } from "./organiser";

// Bare "/" has no content of its own — the homepage is /city/london-gb. Redirect
// on the SERVER (loader) so the root NEVER depends on client JS.
//
// Before this route, "/" fell through to the client-gated catchall
// (app/routes/catchall.tsx renders null on the server, then <AnimatedRoutes/>
// after hydration), whose only output for "/" was a client-side <Navigate>. When
// hydration bailed (the site-wide React #421, now fixed) OR the client bundle
// failed to load (stale chunk after a deploy), that navigate never ran and the
// root served a blank page. A loader redirect removes that whole failure class:
// the edge/server answers "/" with a 307 to /city/london-gb (an on-demand SSR +
// tagged-ISR route, edge-cached and purged via the home-feed tag), with zero
// reliance on the client.
//
// 307 (temporary) so it is not hard-cached by browsers — keeps future geo /
// last-city root routing possible without fighting a cached permanent redirect.
//
// EXCEPT on an event subdomain (<label>.bachatacalendar.co.uk): there "/" IS the
// event page. vercel.json rewrites do not change the path React Router sees, so
// this route runs the /event loader with params.id = <label> (flag / test-label
// gate and www fallbacks live in that loader).
//
// ORGANISER sub-address (flag ORGANISER_SUBDOMAIN_LINKS / test labels): the label is
// resolved as an EVENT first, unchanged. Only when no event answers does it try an
// organiser. Flag off and label not listed = this block is skipped entirely.
function withOrganiserLabel(res: unknown, label: string): unknown {
  const r = res as { type?: string; data?: object; init?: ResponseInit | null } | null;
  if (r && r.type === "DataWithResponseInit") {
    return routerData({ ...(r.data as object), organiserLabel: label }, r.init ?? undefined);
  }
  return { ...(res as object), organiserLabel: label };
}

export async function loader(args: { request: Request; context?: unknown }) {
  const url = new URL(args.request.url);
  const host = args.request.headers.get("x-forwarded-host") ?? args.request.headers.get("host") ?? url.host;
  const info = parseEventHost(host);
  if (info.kind === "event" && organiserHostServable(info.label)) {
    const event = await resolvePublicEventRef(info.label, "throw");
    if (!event?.id) {
      const org = await resolvePublicOrganiserRef(info.label, "throw");
      if (org?.id && org.slug) {
        // Old slug -> the current sub-address, one hop.
        if (org.slug !== info.label) {
          throw redirect(
            isSubdomainLabel(org.slug)
              ? `${organiserSubdomainOrigin(org.slug)}/`
              : `https://www.bachatacalendar.co.uk/organisers/${org.slug}`,
            301,
          );
        }
        const res = await organiserLoader({ ...args, params: { id: info.label } } as unknown as Parameters<
          typeof organiserLoader
        >[0]);
        return withOrganiserLabel(res, info.label);
      }
    }
  }
  if (info.kind !== "none") {
    return eventLoader({ ...args, params: { id: info.label } } as unknown as Parameters<typeof eventLoader>[0]);
  }
  throw redirect("/city/london-gb", 307);
}

// Client-side navigation to "/": on www (header logo, Link to="/") the server
// loader would 307 to the city page, so redirect here too (a null would render
// a blank page). On an event host, fetch the event page from the server.
export async function clientLoader({ serverLoader }: { serverLoader: () => Promise<unknown> }) {
  if (parseEventHost(window.location.host).kind !== "none") return serverLoader();
  throw redirect("/city/london-gb");
}

export function headers(args: { loaderHeaders: Headers }) {
  return eventHeaders(args as unknown as Parameters<typeof eventHeaders>[0]);
}

export function meta(args: { data?: unknown }) {
  if (args.data && typeof args.data === "object" && "organiserLabel" in args.data) {
    return organiserMeta(args as unknown as Parameters<typeof organiserMeta>[0]);
  }
  return args.data ? eventMeta(args as unknown as Parameters<typeof eventMeta>[0]) : [];
}

// useParams() in the organiser page reads :id from the route match; "/" has none, so
// hand it the label through a synthetic match (same as /organisers/<label>).
function OrganiserOnSubdomain(props: { loaderData: { organiserLabel: string } }) {
  const ctx = useContext(UNSAFE_RouteContext);
  const label = props.loaderData.organiserLabel;
  const match = {
    params: { id: label },
    pathname: "/",
    pathnameBase: "/",
    route: { id: "organiser-subdomain", path: "/" },
  };
  return (
    <UNSAFE_RouteContext.Provider value={{ ...ctx, matches: [...ctx.matches, match as never] }}>
      <OrganiserRoute
        {...(props as unknown as Parameters<typeof OrganiserRoute>[0])}
        params={{ id: label } as never}
      />
    </UNSAFE_RouteContext.Provider>
  );
}

// Renders only on an event host (elsewhere the loader redirected first).
export default function RootIndex(props: { loaderData?: unknown }) {
  if (!props.loaderData) return null;
  if (typeof props.loaderData === "object" && "organiserLabel" in props.loaderData) {
    return <OrganiserOnSubdomain loaderData={props.loaderData as { organiserLabel: string }} />;
  }
  return <EventRoute {...(props as unknown as Parameters<typeof EventRoute>[0])} />;
}
