import { describe, expect, it } from 'vitest';
import { SITE_IA, EVENT_PARENT_SENTINEL } from '@/lib/breadcrumbs';

/**
 * Tree-validity tests for the IA. These guard against mistakes when adding
 * or moving routes — every parent reference must resolve, no two routes can
 * share a path, every entity route needs a detailPath, etc.
 *
 * If you add a route to siteIa.ts and one of these tests fails, the IA tree
 * is malformed — fix the tree, not the test.
 */

const ALL_ROUTE_IDS = Object.keys(SITE_IA);

describe('SITE_IA — tree validity', () => {
  it('every parent reference resolves to an existing route id (or sentinel)', () => {
    for (const id of ALL_ROUTE_IDS) {
      const node = SITE_IA[id as keyof typeof SITE_IA] as { parent?: string };
      if (!node.parent) continue;
      if (node.parent === EVENT_PARENT_SENTINEL) continue;
      expect(
        ALL_ROUTE_IDS,
        `route "${id}" has parent "${node.parent}" which is not a route id`,
      ).toContain(node.parent);
    }
  });

  it('no two routes share the same path', () => {
    const seen = new Map<string, string>();
    for (const id of ALL_ROUTE_IDS) {
      const node = SITE_IA[id as keyof typeof SITE_IA] as { path?: string };
      if (!node.path) continue;
      const prior = seen.get(node.path);
      expect(
        prior,
        `routes "${id}" and "${prior}" share path "${node.path}"`,
      ).toBeUndefined();
      seen.set(node.path, id);
    }
  });

  it('no parent cycles exist', () => {
    for (const id of ALL_ROUTE_IDS) {
      const visited = new Set<string>();
      let cursor: string | undefined = id;
      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        const node = SITE_IA[cursor as keyof typeof SITE_IA] as { parent?: string };
        const parent = node?.parent;
        if (!parent || parent === EVENT_PARENT_SENTINEL) break;
        cursor = parent;
      }
      // If we didn't break out via parent === undefined or sentinel, we cycled.
      const node = SITE_IA[cursor as keyof typeof SITE_IA] as { parent?: string };
      const finalParent = node?.parent;
      const cycledBack = !!finalParent && finalParent !== EVENT_PARENT_SENTINEL && visited.has(finalParent);
      expect(cycledBack, `route "${id}" cycles back to "${finalParent}"`).toBe(false);
    }
  });

  it('every route has a non-empty label', () => {
    for (const id of ALL_ROUTE_IDS) {
      const node = SITE_IA[id as keyof typeof SITE_IA];
      expect(node.label, `route "${id}" has empty label`).toBeTruthy();
      expect(node.label.length, `route "${id}" has empty label`).toBeGreaterThan(0);
    }
  });

  it('every entity route has a detailPath function', () => {
    for (const id of ALL_ROUTE_IDS) {
      const node = SITE_IA[id as keyof typeof SITE_IA] as {
        entity?: boolean;
        detailPath?: (id: string) => string;
      };
      if (node.entity !== true) continue;
      expect(
        typeof node.detailPath,
        `entity route "${id}" missing detailPath function`,
      ).toBe('function');
    }
  });

  it('detailPath functions return absolute paths starting with /', () => {
    for (const id of ALL_ROUTE_IDS) {
      const node = SITE_IA[id as keyof typeof SITE_IA] as {
        entity?: boolean;
        detailPath?: (id: string) => string;
      };
      if (!node.detailPath) continue;
      const sample = node.detailPath('sample-id');
      expect(sample.startsWith('/'), `route "${id}" detailPath did not start with /`).toBe(true);
    }
  });
});
