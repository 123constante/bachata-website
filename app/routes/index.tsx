import { redirect } from "react-router";
import { parseEventHost } from "../lib/eventSubdomain";
import EventRoute, { headers as eventHeaders, loader as eventLoader, meta as eventMeta } from "./event";

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
export function loader(args: { request: Request; context?: unknown }) {
  const url = new URL(args.request.url);
  const host = args.request.headers.get("x-forwarded-host") ?? args.request.headers.get("host") ?? url.host;
  const info = parseEventHost(host);
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
  return args.data ? eventMeta(args as unknown as Parameters<typeof eventMeta>[0]) : [];
}

// Renders only on an event host (elsewhere the loader redirected first).
export default function RootIndex(props: { loaderData?: unknown }) {
  if (!props.loaderData) return null;
  return <EventRoute {...(props as unknown as Parameters<typeof EventRoute>[0])} />;
}
