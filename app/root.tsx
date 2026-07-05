import { useState } from "react";
import { Links, Meta, Outlet, Scripts, type MetaFunction } from "react-router";
import { AppProviders, createQueryClient, getBrowserQueryClient } from "@/App";
import { ScrollToTop } from "@/components/ScrollToTop";
import { CityProvider } from "@/contexts/CityContext";
import { SearchProvider } from "@/components/search/SearchProvider";
import { AppChrome } from "@/components/AppChrome";
import { useNonce } from "./nonce";
import "@/index.css";
import "@fontsource-variable/inter";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://stsdtacfauprzrdebmzg.supabase.co" />
        <link rel="preconnect" href="https://media.bachatacalendar.co.uk" />
        <link rel="preconnect" href="https://a.basemaps.cartocdn.com" crossOrigin="" />
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
