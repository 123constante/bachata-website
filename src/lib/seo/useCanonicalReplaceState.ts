/**
 * useCanonicalReplaceState - swap the address bar from a UUID URL to the
 * canonical slug URL once the entity's slug is known.
 *
 * Pages that load via /event/{uuid} call this with the resolved slug; the URL
 * silently flips to /event/{slug} via history.replaceState (no navigation,
 * no scroll jump). External UUID inbound links still work; users sharing the
 * page from this point onwards copy the slug URL.
 */
import { useEffect } from 'react';

interface Opts {
  /** True only when the URL param was a UUID. Skip the swap otherwise. */
  arrivedViaUuid: boolean;
  /** The entity's slug. Null when the slug query hasn't resolved yet. */
  slug: string | null | undefined;
  /** Builds the canonical pathname from the slug, e.g. (s) => `/event/${s}`. */
  buildPath: (slug: string) => string;
}

export function useCanonicalReplaceState({ arrivedViaUuid, slug, buildPath }: Opts) {
  useEffect(() => {
    if (!arrivedViaUuid || !slug) return;
    if (typeof window === 'undefined') return;
    const target = buildPath(slug) + window.location.search + window.location.hash;
    if (window.location.pathname + window.location.search + window.location.hash === target) return;
    window.history.replaceState(window.history.state, '', target);
  }, [arrivedViaUuid, slug, buildPath]);
}
