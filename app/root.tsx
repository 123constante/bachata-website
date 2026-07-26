import { useEffect, useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  isRouteErrorResponse,
  useRouteError,
  type LinksFunction,
  type MetaFunction,
} from "react-router";
// Hashed URL of the latin subset the body text actually renders with -- used
// by links() below to preload it (Inter is otherwise discovered only after the
// blocking stylesheet parses, guaranteeing a visible font swap on the h1).
import interLatinWoff2 from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { captureException } from "@/lib/sentry";
import { AppProviders, createQueryClient, getBrowserQueryClient } from "@/App";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CityProvider } from "@/contexts/CityContext";
import { SearchProvider } from "@/components/search/SearchProvider";
import { AppChrome } from "@/components/AppChrome";
import { useNonce } from "./nonce";
import "@/index.css";
import "@fontsource-variable/inter";

// Preload the Inter latin woff2 (~48KB, font-display:swap via @fontsource).
// unicode-range means latin is the only subset English content fetches, so one
// preload covers the real render path; other subsets stay lazy.
export const links: LinksFunction = () => [
  {
    rel: "preload",
    as: "font",
    type: "font/woff2",
    href: interLatinWoff2,
    crossOrigin: "anonymous",
  },
];

// Site-wide SEO defaults. A leaf route's meta() REPLACES this (RR7 leaf-wins),
// so detail routes emit their own full set; everything else inherits these.
export const meta: MetaFunction = () => [
  { title: "Bachata London — Events, Classes & Parties Calendar" },
  {
    name: "description",
    content:
      "Classes, socials and festivals for London's Bachata dance community. Find your next dance.",
  },
  { property: "og:type", content: "website" },
  { property: "og:site_name", content: "Bachata Calendar" },
  { property: "og:title", content: "Bachata London — Events, Classes & Parties Calendar" },
  {
    property: "og:description",
    content: "Classes, socials and festivals for London's Bachata dance community.",
  },
  { property: "og:image", content: "https://www.bachatacalendar.co.uk/og-image.jpg" },
  { name: "twitter:card", content: "summary_large_image" },
];

// Static <head> content lifted verbatim from index.html (charset/viewport/
// favicons/manifest/theme-color/preconnects). <Meta/> + <Links/> render the
// route-managed tags after these defaults.
export function Layout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce (server); undefined on the client (see app/nonce.ts).
  const nonce = useNonce();
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* No hardcoded canonical here: it would self-canonicalize every route to
            the homepage AND duplicate the per-page canonical that detail routes
            emit via meta(). Routes own their canonical; the client useSeo effect
            still sets one for catchall pages, and bots get theirs from middleware. */}
        {/* No fonts.googleapis/gstatic preconnects: Inter is self-hosted
            (bundled + preloaded via links()), and the only Google-Fonts user is
            the DECORATIVE loader that runs at window.load (entry.client) --
            warming those connections during the critical path spent two mobile
            TLS handshakes on fonts nothing above the fold waits for. */}
        <link rel="preconnect" href="https://stsdtacfauprzrdebmzg.supabase.co" />
        {/* R2 media bucket: direct-origin fetches (dev, full-size gallery views,
            anything not yet routed through /_vercel/image). The previous target,
            media.bachatacalendar.co.uk, was a dangling DNS record pointing at
            Vercel -- it never served a byte. */}
        <link rel="preconnect" href="https://pub-07f606224cac4f2596903c44df723644.r2.dev" />
        {/* Carto basemap tiles. Leaflet rotates the subdomain across a/b/c/d
            ({s} in EventMap's tile URL), and the homepage LCP element is one of
            these tiles -- preconnecting only `a` left b/c/d to a cold connect on
            the critical path (measured resourceLoadDelay ~3.2s). Warm all four. */}
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://b.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://c.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="preconnect" href="https://d.basemaps.cartocdn.com" crossOrigin="" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#141519" />
        <meta property="og:locale" content="en_GB" />
        <meta property="fb:app_id" content="940936962157954" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts nonce={nonce} />
        {/* Deliberately NO <ScrollRestoration/>: the app keeps its existing
            ScrollToTop + history.scrollRestoration='manual' regime (set in
            entry.client). Two scroll managers fight. */}
      </body>
    </html>
  );
}

// RR7 root ErrorBoundary. Catches what the class boundaries CANNOT: loader/SSR
// throws (e.g. the intentional fetchQuery gate in routes/home.tsx) and render
// errors that escape a page's own boundary. Without this, RR7 renders its
// unstyled built-in error page. Rendered inside <Layout/> by the framework, so
// it must NOT depend on AppProviders/loader data — those may be exactly what
// failed. Server-side capture is handled by entry.server's handleError; this
// effect covers the client (hydration/navigation) case only.
export function ErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 404-style route responses are expected, not errors worth reporting.
    if (isRouteErrorResponse(error) && error.status < 500) return;
    const err = error instanceof Error ? error : new Error(String(error));
    captureException(err, { boundary: "RootErrorBoundary" });
  }, [error]);

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const heading = isNotFound ? "Page not found" : "Something went wrong";
  const body = isNotFound
    ? "We couldn't find that page. It may have moved or been removed."
    : "This page ran into an unexpected error. Try again, or head back to the calendar.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 pt-[84px] text-center">
      <div className="text-5xl">{isNotFound ? "🔍" : "🥲"}</div>
      <h1 className="text-2xl font-bold text-foreground">{heading}</h1>
      <p className="max-w-sm text-muted-foreground">{body}</p>
      <a
        href="/"
        className="mt-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
      >
        Back to the calendar
      </a>
    </div>
  );
}

export default function Root() {
  // Phase-2 invariant: getBrowserQueryClient() THROWS on the server, so a
  // server render mints a fresh per-request client; the browser reuses the
  // shared singleton. useState initializer runs once per mount.
  const [queryClient] = useState(() =>
    typeof window === "undefined" ? createQueryClient() : getBrowserQueryClient(),
  );

  // AppShell minus BrowserRouter — the framework router provides the routing
  // context. AppChrome renders <Outlet/> in its <main> in place of the legacy
  // lazy <AnimatedRoutes/>.
  return (
    <AppProviders client={queryClient}>
      <ScrollToTop />
      <CityProvider>
        <SearchProvider>
          <AppChrome>
            <Outlet />
          </AppChrome>
        </SearchProvider>
      </CityProvider>
    </AppProviders>
  );
}
