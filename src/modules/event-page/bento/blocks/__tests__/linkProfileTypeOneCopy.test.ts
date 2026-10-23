/**
 * W1 code-review round 2 R10: the profile type a lineup chip logs is read off the link's route
 * prefix, and those prefixes are searchEntities hrefFor's, not a second hard-coded copy. Pinned
 * by moving hrefFor's routes: the chip must follow them.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/searchEntities', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/searchEntities')>();
  return { ...real, hrefFor: (kind: Parameters<typeof real.hrefFor>[0], id: string) => `/moved${real.hrefFor(kind, id)}` };
});

import { hrefFor } from '@/lib/searchEntities';
import { profileTypeForLink } from '@/modules/event-page/bento/blocks/schedule/PersonChip';

describe('PersonChip link profile type: one copy of the route prefixes', () => {
  it.each(['dj', 'dancer', 'teacher', 'vendor', 'organiser'] as const)('%s link logs its own kind', (kind) => {
    expect(profileTypeForLink(hrefFor(kind, 'abc'), 'feed')).toBe(kind);
  });
  it('an unknown route keeps the feed type', () => {
    expect(profileTypeForLink('/event/abc', 'feed')).toBe('feed');
  });
});
