/**
 * Public API for the breadcrumbs module. Page components should import from
 * '@/lib/breadcrumbs' rather than the individual files inside this folder.
 */

export {
  buildBreadcrumbs,
  resolveEventParent,
  type BaseContext,
  type EntityContext,
  type EventContext,
  type EventType,
  type EventTypeInput,
  type BreadcrumbItemType,
  type RouteId,
  type EntityRouteId,
  type EventRouteId,
} from './buildBreadcrumbs';

export { SITE_IA, EVENT_PARENT_SENTINEL } from './siteIa';

export {
  buildBreadcrumbListJsonLd,
  renderBreadcrumbListJsonLd,
  type BreadcrumbListJsonLd,
  type BuildJsonLdInput,
} from './jsonLd';
