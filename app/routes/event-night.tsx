import { redirect } from "react-router";
import { staticShellCacheHeaders } from "../detailLoader";
import { EVENT_SUBDOMAIN_DOMAIN, parseEventHost, parseNightPath } from "../lib/eventSubdomain";
import CatchAll from "./catchall";
import EventRoute, { headers as eventHeaders, loader as eventLoader, meta as eventMeta } from "./event";

// "/<day>-<mon>[-<year>]" on an event subdomain (<label>.bachatacalendar.co.uk/19-dec)
// is one night of that event. vercel.json rewrites do NOT change the path React
// Router matches, so the app serves it: this ":night" route runs the /event loader
// with params.id = <label> and ?night=<night>.
//
// ":night" matches EVERY single-segment path that no static route claims, which
// the catchall (client shell) used to serve on www. So off an event host this
// route must behave exactly like the catchall: loader returns null, the default
// export IS the catchall, headers() are the catchall's. clientLoader keeps
// client-side navigations off an event host from making a .data request.
export function loader(args: { request: Request; params: { night?: string }; context?: unknown }) {
  const url = new URL(args.request.url);
  const host = args.request.headers.get("x-forwarded-host") ?? args.request.headers.get("host") ?? url.host;
  const info = parseEventHost(host);
  if (info.kind === "none") return null;
  const night = args.params.night ?? "";
  if (!parseNightPath(night)) {
    // Not a night path: same forward as the root loader (it normally fires first).
    throw redirect(`https://www.${EVENT_SUBDOMAIN_DOMAIN}${url.pathname}${url.search}`, 302);
  }
  url.searchParams.set("night", night);
  return eventLoader({
    ...args,
    params: { id: info.label },
    request: new Request(url, args.request),
  } as unknown as Parameters<typeof eventLoader>[0]);
}

// Off an event host: no data (the catchall shell). On an event host (e.g. the
// "Go to the next night" button), fetch the night from the server.
export async function clientLoader({ serverLoader }: { serverLoader: () => Promise<unknown> }) {
  if (parseEventHost(window.location.host).kind !== "none") return serverLoader();
  return null;
}

export function headers(args: { loaderHeaders: Headers; [k: string]: unknown }) {
  return args.loaderHeaders.get("Vercel-Cache-Tag")
    ? eventHeaders(args as unknown as Parameters<typeof eventHeaders>[0])
    : staticShellCacheHeaders();
}

export function meta(args: { data?: unknown; [k: string]: unknown }) {
  return args.data ? eventMeta(args as unknown as Parameters<typeof eventMeta>[0]) : [];
}

export default function EventNightRoute(props: { loaderData?: unknown; params: { night?: string } }) {
  if (!props.loaderData) return <CatchAll />;
  return <EventRoute {...(props as unknown as Parameters<typeof EventRoute>[0])} />;
}
