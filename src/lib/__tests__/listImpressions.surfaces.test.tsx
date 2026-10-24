// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn((..._a: unknown[]) => Promise.resolve({ data: null, error: null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/lib/viewerSession', () => ({ getViewerSession: () => 'sess-1' }));

import VenueWhatsOnList from '@/components/venue/VenueWhatsOnList';
import { DjUpcoming } from '@/components/dj/DjTiles';
import EventRow from '@/components/events/EventRow';
import { useListImpressions } from '@/lib/listImpressions';

let observed: Element[] = [];
let fire: (els: Element[]) => void = () => {};
class FakeIO {
  constructor(cb: (e: Partial<IntersectionObserverEntry>[]) => void) {
    fire = (els) => cb(els.map((target) => ({ target, isIntersecting: true, intersectionRatio: 1 })));
  }
  observe(el: Element) { observed.push(el); }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.useFakeTimers();
  rpc.mockClear();
  observed = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const seeAllThenLeave = (unmount: () => void) => {
  fire(observed);
  vi.advanceTimersByTime(1000);
  unmount();
};

const expectOneBatch = (surface: string, ids: string[]) => {
  expect(rpc).toHaveBeenCalledTimes(1);
  const [name, args] = rpc.mock.calls[0] as unknown as [string, Record<string, unknown>];
  expect(name).toBe('record_list_impressions_v1');
  expect(args.p_surface).toBe(surface);
  expect([...(args.p_event_ids as string[])].sort()).toEqual([...ids].sort());
};

describe('rendered surfaces send one batched call', () => {
  it('venue', () => {
    const ev = (n: string) => ({ event_id: n, occurrence_id: `o${n}`, instance_start: '2026-11-01T20:00:00Z', name: n, poster_url: null, type: null });
    const { unmount } = render(<MemoryRouter><VenueWhatsOnList events={[ev('v1'), ev('v2')]} venueName="V" onSeeAll={() => {}} /></MemoryRouter>);
    seeAllThenLeave(unmount);
    expectOneBatch('venue', ['v1', 'v2']);
  });

  it('profile (DJ upcoming)', () => {
    const g = (n: string) => ({ eventId: n, name: n, startTime: '2026-11-01T20:00:00', location: null });
    const { unmount } = render(<MemoryRouter><DjUpcoming gigs={[g('d1'), g('d2')]} /></MemoryRouter>);
    seeAllThenLeave(unmount);
    expectOneBatch('profile', ['d1', 'd2']);
  });

  it('organiser (shared EventRow with impressionRef)', () => {
    const Harness = () => {
      const t = useListImpressions('organiser');
      return (
        <MemoryRouter>
          {['o1', 'o2'].map((id) => (
            <EventRow key={id} href={`/event/${id}`} name={id} posterUrl={null} dateDay="1" dateMon="NOV" meta="m" impressionRef={t(id)} />
          ))}
        </MemoryRouter>
      );
    };
    const { unmount } = render(<Harness />);
    seeAllThenLeave(unmount);
    expectOneBatch('organiser', ['o1', 'o2']);
  });
});

// Heavy page-level surfaces cannot render in a unit test without mocking most of
// the app, so pin the wiring statically: each surface file declares its surface
// name and attaches a tracked ref to its card element.
describe('every surface is wired (static table)', () => {
  const rows: [string, string, RegExp][] = [
    ['home', 'src/modules/home-map/cards/AllEventsList.tsx', /useListImpressions\('home'\)[\s\S]*trackRef=\{trackImpression\(/],
    ['city', 'src/components/seo/LiveEventsSection.tsx', /useListImpressions\('city'\)[\s\S]*ref=\{trackImpression\(/],
    ['search', 'src/pages/SearchResults.tsx', /useListImpressions\('search'\)[\s\S]*trackRef=\{trackImpression\(/],
    ['more_events', 'src/modules/event-page/sections/MoreEventsSection.tsx', /useListImpressions\('more_events'\)[\s\S]*trackRef=\{trackImpression\(/],
    ['organiser', 'src/pages/OrganiserProfile.tsx', /useListImpressions\('organiser'\)[\s\S]*impressionRef=\{trackImpression\(/],
    ['calendar', 'src/components/calendar/CalendarListView.tsx', /useListImpressions\('calendar'\)[\s\S]*trackRef=\{trackImpression\(/],
    ['tonight', 'src/pages/Tonight.tsx', /useListImpressions\('tonight'\)[\s\S]*ref=\{trackImpression\(/],
    ['festivals', 'src/pages/FestivalHub.tsx', /useListImpressions\('festivals'\)[\s\S]*ref=\{trackImpression\(/],
    ['venue', 'src/components/venue/VenueWhatsOnList.tsx', /useListImpressions\('venue'\)[\s\S]*ref=\{track\(/],
    ['profile', 'src/components/dj/DjTiles.tsx', /useListImpressions\('profile'\)[\s\S]*ref=\{track\(/],
  ];
  it.each(rows)('%s', (_surface, file, re) => {
    expect(readFileSync(file, 'utf8')).toMatch(re);
  });
});
