import type { BreadcrumbItemType } from '@/components/PageBreadcrumb';
import {
  SITE_IA,
  EVENT_PARENT_SENTINEL,
  type RouteId,
  type EntityRouteId,
  type EventRouteId,
} from './siteIa';

export type { BreadcrumbItemType, RouteId, EntityRouteId, EventRouteId };

/**
 * Event-type categories that determine the parent of /event/:id and
 * /event/:id/edit breadcrumbs. The runtime accepts ANY string (so raw DB
 * values flow through without casts); known values get the right parent,
 * unknown ones fall back to 'parties'.
 *
 * Source of truth: events.event_type values seen in the live DB.
 */
export type EventType =
  | 'party'
  | 'social'
  | 'class'
  | 'workshop'
  | 'social_class'
  | 'festival'
  | 'congress'
  | 'masterclass';

/** Accepted at the call site for ctx.eventType. The (string & {}) trick keeps
 *  IDE autocomplete on EventType while still permitting any raw string. */
export type EventTypeInput = EventType | (string & {}) | undefined | null;

/** Base context — always allowed. */
export interface BaseContext {
  /** When true, the entity-bearing final crumb is dropped and the parent
   *  becomes the current (non-clickable) page. Prevents 'undefined' flashes. */
  isLoading?: boolean;
}

/** Required for entity-bearing detail routes. */
export interface EntityContext extends BaseContext {
  /** The pre-loaded entity name. May be undefined while the data is still
   *  fetching — combine with isLoading=true to suppress the placeholder. */
  entityName: string | undefined;
  /** The entity's id, used to build the detail link when this route appears
   *  as an INTERMEDIATE crumb (e.g. event.detail inside event.edit). */
  entityId?: string | undefined;
}

/** Required for event-typed routes (event.detail, event.edit). */
export interface EventContext extends EntityContext {
  /** The event type — drives parent dispatch (party→Parties, class→Classes,
   *  festival→Festivals). Accepts any string for DB-value pass-through;
   *  unknown / undefined / null falls back to 'parties'. */
  eventType: EventTypeInput;
}

// ---------------------------------------------------------------------------
// Public API — overload set forces ctx shape based on routeId.
// ---------------------------------------------------------------------------

export function buildBreadcrumbs(
  routeId: EventRouteId,
  ctx: EventContext,
): BreadcrumbItemType[];
export function buildBreadcrumbs(
  routeId: Exclude<EntityRouteId, EventRouteId>,
  ctx: EntityContext,
): BreadcrumbItemType[];
export function buildBreadcrumbs(
  routeId: Exclude<RouteId, EntityRouteId>,
  ctx?: BaseContext,
): BreadcrumbItemType[];
export function buildBreadcrumbs(
  routeId: RouteId,
  ctx: Partial<EventContext> = {},
): BreadcrumbItemType[] {
  const eventType = ctx.eventType;
  const entityName = ctx.entityName;
  const entityId = ctx.entityId;
  const isLoading = !!ctx.isLoading;

  // Walk the parent chain, top-down. Cycle guard: never visit the same id
  // twice (defends against accidental cycles in the IA tree).
  const chain: RouteId[] = [];
  const visited = new Set<RouteId>();
  let cursor: RouteId | undefined = routeId;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    chain.unshift(cursor);
    const node = SITE_IA[cursor];
    const parent = node.parent;
    if (!parent) break;
    if (parent === EVENT_PARENT_SENTINEL) {
      cursor = resolveEventParent(eventType);
    } else if (parent in SITE_IA) {
      cursor = parent as RouteId;
    } else {
      // Unknown parent — break gracefully. siteIa.test.ts guarantees this
      // never happens for routes added to SITE_IA, but defensive in prod.
      break;
    }
  }

  // Map chain → breadcrumb items.
  const items: BreadcrumbItemType[] = [];
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    const node = SITE_IA[id];
    const isLast = i === chain.length - 1;
    const isEntityNode = 'entity' in node && node.entity === true;

    if (isEntityNode) {
      if (isLast) {
        // Final crumb on an entity route.
        if (isLoading || !entityName) {
          // Drop this crumb entirely — the parent listing becomes the
          // current page. Strip its path so it renders as non-clickable.
          if (items.length > 0) {
            items[items.length - 1] = { label: items[items.length - 1].label };
          }
          // If there's no parent at all (shouldn't happen), fall back to
          // showing the placeholder label so the row isn't empty.
          if (items.length === 0) {
            items.push({ label: node.label });
          }
        } else {
          items.push({ label: entityName });
        }
      } else {
        // Intermediate entity crumb (e.g. event.detail inside event.edit).
        // Use entityName when available; link to detail page when entityId given.
        const detailPath = node.detailPath;
        items.push({
          label: entityName || node.label,
          path: detailPath && entityId ? detailPath(entityId) : undefined,
        });
      }
    } else {
      // Non-entity route.
      if (isLast) {
        // Current page — strip path so it renders as non-clickable.
        items.push({ label: node.label });
      } else {
        items.push({
          label: node.label,
          path: 'path' in node ? node.path : undefined,
        });
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Helpers (also exported for unit testing).
// ---------------------------------------------------------------------------

/**
 * Pick the parent route for /event/:id based on event type. Defaults to
 * 'parties' for unknown / undefined / null event types — that's the safe
 * fallback because parties is the most common content category.
 */
export function resolveEventParent(eventType: EventTypeInput): RouteId {
  switch (eventType) {
    case 'class':
    case 'workshop':
    case 'social_class':
    case 'masterclass':
      return 'classes';
    case 'festival':
    case 'congress':
      return 'festivals';
    case 'party':
    case 'social':
    default:
      return 'parties';
  }
}
