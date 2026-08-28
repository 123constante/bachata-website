// GUEST-LIST OVERFLOW PROOF.
//
// The pill stack renders one name per row with no slice, no max-height and no overflow, and
// BentoGrid gives `guest` a minH with no maximum -- so the tile grew without limit. Measured
// against the real all-time peak for a single night (58 names, London Loves BOS 2026-05-30)
// the tile came to ~1,941px: roughly five phone screens of pills, with the join form below
// all of it. Nothing capped it because nothing ever had.
//
// What makes this worth pinning rather than eyeballing: the truncation is invisible on the
// lists that exist TODAY. Every current event renders 0-15 names, all under the threshold,
// so a regression that broke the cap would look completely healthy in the browser until the
// next busy Saturday. These cases are the only thing standing between that and prod.
//
// Follows the sibling waitlist file: renderToStaticMarkup under the `node` environment, no
// testing-library, no DOM.
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EventGuestList, GuestListEntry } from '@/modules/event-page/hooks/useEventGuestList';

const guestListData = { current: undefined as EventGuestList | undefined };

vi.mock('@/modules/event-page/hooks/useEventGuestList', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/event-page/hooks/useEventGuestList')
  >('@/modules/event-page/hooks/useEventGuestList');
  return { ...actual, useEventGuestList: () => ({ data: guestListData.current }) };
});

vi.mock('@/modules/event-page/hooks/useSubmitGuestListEntry', () => ({
  useSubmitGuestListEntry: () => ({ mutate: () => {}, isPending: false, reset: () => {} }),
}));

vi.mock('@/lib/confetti', () => ({ triggerMicroConfetti: () => {} }));

// The drawer is stubbed to a PROBE, and that is the point of the mock rather than a way to
// avoid rendering it. Under the `node` environment a vaul Drawer emits no markup at all, so
// the real component would leave nothing to assert against -- and the single likeliest bug
// in this change (handing the drawer the TRUNCATED slice, so "See all 58" opens onto 10
// names) would be completely invisible. The probe publishes the length it was actually
// handed. The drawer's own rendering is proved separately, under jsdom, in
// modals/__tests__/SeeAllGuestsDrawer.test.tsx.
const drawerProps = { current: undefined as { entries: GuestListEntry[]; open: boolean } | undefined };

vi.mock('@/modules/event-page/bento/modals/SeeAllGuestsDrawer', () => ({
  SeeAllGuestsDrawer: (p: { entries: GuestListEntry[]; open: boolean }) => {
    drawerProps.current = p;
    return null;
  },
}));

const { GuestListBlock } = await import('@/modules/event-page/bento/blocks/GuestListBlock');

const CONFIG = {
  cutoff_time: '20:00',
  discount_until: '20:00',
  description: '',
  regular_party_price: null,
  guest_list_party_price: null,
  regular_class_party_price: null,
  guest_list_class_party_price: null,
};

let seq = 0;
const entry = (first_name: string, status?: 'active' | 'waitlist'): GuestListEntry => ({
  first_name,
  created_at: `2026-08-27T20:00:${String((seq += 1) % 60).padStart(2, '0')}Z`,
  ...(status ? { status } : {}),
});

// n distinct names. Distinct matters: the pill key is the normalised first name, so
// repeated names would collapse into one node and understate the rendered count.
const names = (n: number, status?: 'active' | 'waitlist'): GuestListEntry[] =>
  Array.from({ length: n }, (_, i) => entry(`Dancer${i + 1}`, status));

const list = (o: Partial<EventGuestList> = {}): EventGuestList => {
  const entries = o.entries ?? [];
  const active = entries.filter((e) => e.status !== 'waitlist').length;
  return {
    enabled: true,
    count: active,
    entries,
    config: CONFIG,
    cutoff_passed: false,
    active_count: active,
    waitlist_count: entries.length - active,
    capacity_max: null,
    waitlist_enabled: null,
    spots_left: null,
    ...o,
  };
};

const renderBlock = (data: EventGuestList): string => {
  guestListData.current = data;
  drawerProps.current = undefined;
  return renderToStaticMarkup(
    <GuestListBlock eventId="e1" eventStartIso={null} eventTimezone={null} />,
  );
};

// Counts rendered pills by their stacked-variant class rather than by name, so the count
// does not depend on what the names happen to be.
const pillCount = (html: string) => (html.match(/gl-pill--stacked/g) ?? []).length;

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

describe('GuestListBlock — pill overflow', () => {
  it('a short list renders every name and offers no reveal', () => {
    const html = renderBlock(list({ entries: names(5) }));
    expect(pillCount(html)).toBe(5);
    expect(text(html)).not.toContain('See all');
  });

  it('THE BOUNDARY: 12 names render whole, 13 truncate', () => {
    // Pins OVERFLOW_THRESHOLD from both sides. A one-off in either direction moves exactly
    // one of these two, which is why they are asserted together rather than in one case.
    const at = renderBlock(list({ entries: names(12) }));
    expect(pillCount(at)).toBe(12);
    expect(text(at)).not.toContain('See all');

    const over = renderBlock(list({ entries: names(13) }));
    expect(pillCount(over)).toBe(10);
    expect(text(over)).toContain('See all 13');
  });

  it('THE REAL PEAK: 58 names render 10 pills, not 58', () => {
    // The measured worst case. Before this change all 58 rendered, at ~1,941px.
    const html = renderBlock(list({ entries: names(58) }));
    expect(pillCount(html)).toBe(10);
    expect(text(html)).toContain('See all 58');
  });

  it('the reveal is labelled with the TOTAL, never the hidden remainder', () => {
    // "+48 more" was the alternative and it is the one that goes stale: a realtime insert
    // changes the remainder and the total in opposite-feeling ways, and the remainder has
    // no relationship to the headline count sitting directly above it.
    const html = renderBlock(list({ entries: names(58) }));
    const t = text(html);
    expect(t).toContain('See all 58');
    expect(t).not.toContain('48');
    expect(t).not.toContain('more');
  });

  it('THE WIRING: the drawer is handed every name, not the truncated slice', () => {
    // The bug this exists to catch. Passing the sliced array compiles, typechecks, renders
    // identically, and makes "See all 58" open onto 10 names.
    renderBlock(list({ entries: names(58) }));
    expect(drawerProps.current?.entries).toHaveLength(58);
  });

  it('the drawer starts closed', () => {
    renderBlock(list({ entries: names(58) }));
    expect(drawerProps.current?.open).toBe(false);
  });

  it('truncating the pills does not suppress the waiting badge', () => {
    // Queued dancers sort last, so on a capped list every waitlist pill is hidden. The
    // count line is the only remaining signal that anyone is queued and must survive.
    const html = renderBlock(
      list({ entries: [...names(58), ...names(3, 'waitlist')] }),
    );
    expect(pillCount(html)).toBe(10);
    expect(text(html)).toContain('+3 waiting');
    expect(text(html)).toContain('See all 61');
  });

  it('an empty list still invites, with no reveal', () => {
    const html = renderBlock(list({ entries: [] }));
    expect(text(html)).toContain('Be the first on the list');
    expect(text(html)).not.toContain('See all');
  });
});
