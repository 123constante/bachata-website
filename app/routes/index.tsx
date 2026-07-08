import { redirect } from "react-router";

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
export function loader() {
  throw redirect("/city/london-gb", 307);
}

// Never renders: the loader always throws the redirect first. Present only so the
// route module has a default export.
export default function RootIndex() {
  return null;
}
