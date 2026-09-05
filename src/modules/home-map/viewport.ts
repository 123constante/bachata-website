// Festival Map -- the ONE definition of the home surface's mobile/desktop
// boundary, for the JS that is allowed to branch on it.
//
// READ THIS BEFORE USING IT. The homepage shell (HomeMapShell) server-renders,
// and `useIsMobile`'s getServerSnapshot returns `false` -- so the server always
// renders the DESKTOP branch of any JS viewport test. Committing SSR'd markup to
// a viewport branch means 95% of visitors hydrate desktop markup and immediately
// re-render to mobile: the React #421 pattern that caused the empty-homepage
// outage (see AppChrome.tsx). Server-side UA sniffing is not an escape hatch
// either -- the route is edge-cached (s-maxage=3600), so UA-varying HTML would
// split and poison the ISR cache.
//
// So: everything the SERVER renders (head + dock + feed) branches in CSS, at the
// 767/768px boundary in index.css. The ONLY JS viewport branch left is the map
// card's chrome, which lives inside HomeMapCard -- a component that is never
// rendered on the server nor on the first client render (it is gated behind the
// effect-set `mapMounted` flag, because Leaflet touches `window` at module
// load). That is what makes the sync-initialised hook below safe.

/** Must stay in lockstep with useIsMobile's MOBILE_BREAKPOINT and the 767px
 *  media queries in index.css, or the CSS layout and the map chrome disagree at
 *  the boundary. */
export const MAP_DESKTOP_MIN = 768;

const DESKTOP_MQ = `(min-width: ${MAP_DESKTOP_MIN}px)`;

/** Live viewport test. Safe to call from event handlers and effects (client
 *  only); returns false during SSR. Never call it during a server-rendered
 *  component's render. */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DESKTOP_MQ).matches;
}

// useIsDesktopMapChrome is DELETED. It was the reactive viewport test that
// picked between the map card's two chromes, and it was justified by a narrow
// argument -- seeding synchronously from matchMedia is only safe because every
// caller sat inside HomeMapCard, which never server-renders. There is now one
// chrome at every viewport (the difference is the card's height, which is CSS),
// so the hook has no callers and the exception it needed no longer has to be
// argued. Do not reintroduce it to branch a server-rendered component: use a
// media query. The imperative isDesktopViewport() above survives because its
// two callers read it inside handlers and effects, never during render.
