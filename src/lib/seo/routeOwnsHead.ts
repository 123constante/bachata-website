import { createContext, useContext } from 'react';

/**
 * True when the current route is a React Router *framework* route whose `meta()`
 * export already emits the authoritative document head (title, description,
 * canonical, og/twitter, robots) into the SSR/prerendered HTML — see
 * app/seoMeta.ts. On those routes useSeo() must NOT also mutate document.head or
 * run the tab-title marquee: it would double-manage the head (fighting RR's
 * <Meta>) and scramble the title. Default false preserves the legacy behaviour
 * for every catchall page, where useSeo() is still the sole head manager.
 */
export const RouteOwnsHeadContext = createContext(false);

export const useRouteOwnsHead = (): boolean => useContext(RouteOwnsHeadContext);
