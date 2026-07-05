/**
 * Public API for the SEO module. Import from '@/lib/seo'.
 *
 * Usage:
 *   useSeo(buildSeoForRoute('parties', { cityDisplay: 'London' }))
 *   useSeo(buildSeoForRoute('event.detail', { entityName, entitySlug, cityDisplay, ogImage, isLoading }))
 *
 *   // Slug-or-id resolution + canonical URL swap on detail pages:
 *   const { id, slug, arrivedViaUuid, notFound } = useEntitySlugOrId(param, 'events');
 *   useCanonicalReplaceState({ arrivedViaUuid, slug, buildPath: (s) => `/event/${s}` });
 */

export { useSeo, SITE_NAME, SITE_ORIGIN, DEFAULT_OG_IMAGE, type SeoInput } from './useSeo';
export { buildSeoForRoute, type SeoContext } from './buildSeoForRoute';
export { useEntitySlugOrId, type EntityTable, type ResolvedEntity } from './useEntitySlugOrId';
export { useCanonicalReplaceState } from './useCanonicalReplaceState';
export { RouteOwnsHeadContext, useRouteOwnsHead } from './routeOwnsHead';
