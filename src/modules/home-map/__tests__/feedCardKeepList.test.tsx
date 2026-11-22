// @vitest-environment jsdom
/**
 * KEEP-LIST for the home feed card (owner rule 2026-11-19, after homeFeedLook
 * dropped the Updated badge and reordered the lines): the card must show, in
 * this order, name > Class time line > Party time line > venue, with the
 * Added/Updated stamp on the RIGHT. A new look may restyle these, never drop or
 * reorder them. Runs with homeFeedLook ON and OFF so both paths hold the list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MapEvent } from '../mapTypes';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';

const flagsMock = vi.hoisted(() => ({ value: {} as Record<string, boolean> }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy({}, { get: (_t, k: string) => flagsMock.value[k] ?? false }) };
});

afterEach(cleanup);

const recent = new Date(Date.now() - 3600_000).toISOString();
const event = {
  occurrence_id: 'o1', event_id: 'e1', name: 'Mix Night', cover_image_url: null, venue_name: 'The Venue', area: null,
  city_slug: 'london-gb', lat: 51.5, lng: -0.1, instance_date: '2026-10-26', start_time: '2026-10-26 19:00:00+00',
  end_time: '2026-10-26 23:30:00+00', type: 'standard', has_party: true, has_class: true,
  class_start: '2026-10-26 19:00:00+00', class_end: '2026-10-26 20:30:00+00',
  party_start: '2026-10-26 21:00:00+00', party_end: '2026-10-26 23:30:00+00',
  created_at: recent, updated_at: recent, freshness_kind: 'updated', is_cancelled: false, cancellation_reason_label: null,
} as unknown as MapEvent;

const before = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe.each([
  { look: true, label: 'homeFeedLook ON' },
  { look: false, label: 'homeFeedLook OFF' },
])('feed card keep-list, $label', ({ look }) => {
  it('shows name, Class line, Party line, venue in order, with the Updated stamp on the right', async () => {
    flagsMock.value = { homePolish: look, homeFeedLook: look };
    installJsdomPolyfills();
    const { EventRow } = await import('../cards/cards');
    const { container } = render(
      <MemoryRouter>
        <EventRow event={event} selected={false} onSelect={() => {}} showFreshness today="2026-10-26" distanceMi={null} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? '';
    const find = (needle: string) => {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) if ((n.textContent ?? '').includes(needle)) return n;
      throw new Error(`keep-list: "${needle}" missing from card: ${text}`);
    };
    const name = find('Mix Night');
    const cls = find('Class');
    const party = find('Party');
    const venue = find('The Venue');
    expect(before(name, cls), 'name before Class').toBe(true);
    expect(before(cls, party), 'Class before Party').toBe(true);
    expect(before(party, venue), 'Party before venue').toBe(true);
    expect(text, 'Updated stamp present').toMatch(/updated/i);
    expect(before(venue, find('Updated') ), 'stamp after the text block (right side)').toBe(true);
  });
});
