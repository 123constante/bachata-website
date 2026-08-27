// P6 CLIENT-RENDER PROOF.
//
// The server half of the capped/waitlist path was proved against prod in a rolled-back
// transaction (cap=1 -> first sign-up active -> spots_left 0 -> next waitlist with
// count/active_count UNCHANGED -> waitlist off -> capacity_full). What that proof could
// NOT reach is the client: whether this block actually renders those payloads the way the
// contract says. No prod event is capped, so the waitlist branches below have never once
// executed against real data, and the first time Ricky sets a cap is the first time they
// run in front of a dancer.
//
// This pins them without capping a real listing. Follows the WeeksLadderBlock precedent --
// renderToStaticMarkup under the `node` environment, no testing-library, no DOM. useEffect
// does not run in a server render, which is what makes the markup deterministic here.
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EventGuestList, GuestListEntry } from '@/modules/event-page/hooks/useEventGuestList';

// The block reads its payload through useEventGuestList. Mock ONLY the hook: entryStatus and
// hasSpotAvailable are the P6 logic under test and must stay real, so importActual supplies
// them. Mocking the whole module would test the mock.
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

// Imported for side effects only at module scope; never called in a server render.
vi.mock('@/lib/confetti', () => ({ triggerMicroConfetti: () => {} }));

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
  created_at: `2026-08-27T20:0${(seq += 1) % 10}:00Z`,
  ...(status ? { status } : {}),
});

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

// Renders the block against a payload. eventStartIso/eventTimezone are null so the live
// countdown hides -- it is not what this file is proving and it would make the markup
// depend on the wall clock.
const renderBlock = (data: EventGuestList): string => {
  guestListData.current = data;
  return renderToStaticMarkup(
    <GuestListBlock eventId="e1" eventStartIso={null} eventTimezone={null} />,
  );
};

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

describe('GuestListBlock — P6 waitlist rendering', () => {
  it('an uncapped list shows no waiting badge and no queued pill', () => {
    const html = renderBlock(list({ entries: [entry('Ana'), entry('Bea')] }));
    expect(text(html)).toContain('2 dancers on the list');
    expect(html).not.toContain('waiting');
    expect(html).not.toContain('gl-pill--waitlist');
  });

  it('THE P6 SEMANTIC: the headline count is active-only, queued dancers are counted apart', () => {
    // Pre-P6 this list would have read "2 dancers on the list". The whole point of the
    // migration is that the queued dancer is no longer folded into the headline.
    const html = renderBlock(list({ entries: [entry('Ana'), entry('Zed', 'waitlist')] }));
    const t = text(html);
    expect(t).toContain('1 dancer on the list');
    expect(t).toContain('+1 waiting');
    expect(t).not.toContain('2 dancers on the list');
  });

  it('a queued entry renders as a waitlist pill and says so on hover', () => {
    const html = renderBlock(
      list({ entries: [entry('Ana'), entry('Yan', 'waitlist'), entry('Zed', 'waitlist')] }),
    );
    expect(html).toContain('gl-pill--waitlist');
    expect(html).toContain('on the waitlist');
    expect(text(html)).toContain('+2 waiting');
    // The active dancer must NOT pick up the queued styling.
    expect(html.match(/gl-pill--waitlist/g)).toHaveLength(2);
  });

  it('a pre-P6 cached payload with no status on its rows still reads as fully active', () => {
    // entryStatus() resolves an absent status to 'active', which is what the pre-P6 payload
    // meant: it published no waitlist rows at all. A cached response in flight during the
    // rollout must not paint every name amber.
    const html = renderBlock(list({ entries: [entry('Ana'), entry('Bea'), entry('Cal')] }));
    expect(html).not.toContain('gl-pill--waitlist');
    expect(text(html)).toContain('3 dancers on the list');
  });

  it('an empty list still renders its invitation, not a zero-waitlist badge', () => {
    const html = renderBlock(list({ entries: [] }));
    expect(text(html)).toContain('Be the first on the list');
    expect(html).not.toContain('waiting');
  });
});
