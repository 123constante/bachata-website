// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPE_KEYS, ws, type ShapeKey } from './wsFixtures';
import {
  PUBLIC_PAGE_NO_ADDRESS, PUBLIC_PAGE_SUB, PUBLIC_PAGE_SUB_PAUSED, PUBLIC_PAGE_WHY, PUBLIC_PAGE_WHY_OTHER, publicPageOf,
} from '../../data/eventPage';
import { eventHref } from '@/lib/seo/eventHref';
import { P3_PATHS } from '../../shell/paths';

/*
 * FIXLIST F-34: "See it as dancers see it" on the organiser event page x every prod
 * shape. Open (same tab, eventHref) only for live and ended (event_view_p5 serves live,
 * paused, ended; paused is the owner's "Hidden"); otherwise disabled with the reason beside it.
 */

const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async () => 8,
  useSendOnce: () => async () => ({ ok: true }),
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

afterEach(cleanup);

/** Each shape: the link's path and subline, or the reason it is off. */
const LIVE = { href: '/event/sensual-fridays', sub: PUBLIC_PAGE_SUB };
const EXPECT: Record<ShapeKey, { href: string; sub: string } | { why: string }> = {
  weekly: LIVE,
  over100: LIVE,
  monthly: LIVE,
  custom: LIVE,
  course: LIVE,
  courseDone: LIVE,
  festival: LIVE,
  oneoff: LIVE,
  oneoffPast: LIVE,
  tonight: LIVE,
  // event_view_p5 serves a paused series to anon with its past dates (_p5_paused_hides_occurrence_v1).
  paused: { href: '/event/sensual-fridays', sub: PUBLIC_PAGE_SUB_PAUSED },
  draft: { why: PUBLIC_PAGE_WHY.draft },
  draftReady: { why: PUBLIC_PAGE_WHY.draft },
  ended: LIVE,
  archived: { why: PUBLIC_PAGE_WHY.archived },
  noSessions: LIVE,
  noTime: LIVE,
  emptyLineup: LIVE,
};

function show(k: ShapeKey) {
  wsQ.value = { isPending: false, isError: false, data: ws(k), error: null, refetch: vi.fn() };
  return render(
    <MemoryRouter initialEntries={[P3_PATHS.event('ser-1')]}>
      <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('F-34 See it as dancers see it x every shape', () => {
  it.each(SHAPE_KEYS)('%s', (k) => {
    show(k);
    const want = EXPECT[k];
    if (k === 'archived') {
      // #1217: a removed event gets the removed card, not the page, so there is no dancer-view row at all
      expect(screen.getByTestId('p3-event-archived')).toBeTruthy();
      expect(screen.queryByTestId('p3-dancer-view')).toBeNull();
      return;
    }
    if ('href' in want) {
      const a = screen.getByTestId('p3-dancer-view');
      expect(a.getAttribute('href')).toBe(want.href);
      expect(a.getAttribute('target')).toBeNull();
      expect(screen.getByTestId('p3-dancer-view-sub').textContent).toBe(want.sub);
      expect(screen.queryByTestId('p3-dancer-view-off')).toBeNull();
    } else {
      expect(screen.queryByTestId('p3-dancer-view')).toBeNull();
      expect(screen.getByTestId('p3-dancer-view-off').getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByTestId('p3-dancer-view-why').textContent).toBe(want.why);
    }
  });
});

describe('F-34 publicPageOf', () => {
  it('builds the path with eventHref (no hand-rolled path)', () => {
    const w = ws('weekly');
    expect(publicPageOf(w).href).toBe(eventHref({ slug: w.series.slug, event_id: w.series.id }));
  });
  // No fallback to the P5 id: resolve_public_event_ref_v1 does not find it for a bridged series.
  it.each(['live', 'ended', 'paused'])('a %s series with no slug is off with the reason', (lc) => {
    const w = ws('weekly');
    expect(publicPageOf({ ...w, series: { ...w.series, lifecycle_status: lc, slug: null } })).toEqual({ href: null, why: PUBLIC_PAGE_NO_ADDRESS });
  });
  it('an unknown status is off with the plain reason', () => {
    const w = ws('weekly');
    expect(publicPageOf({ ...w, series: { ...w.series, lifecycle_status: 'pending_review' } })).toEqual({ href: null, why: PUBLIC_PAGE_WHY_OTHER });
  });
  it('no reason uses an HTML entity or points at a control', () => {
    for (const why of [...Object.values(PUBLIC_PAGE_WHY), PUBLIC_PAGE_WHY_OTHER, PUBLIC_PAGE_NO_ADDRESS, PUBLIC_PAGE_SUB, PUBLIC_PAGE_SUB_PAUSED]) expect(why).not.toMatch(/&\w+;|button|tap/i);
  });
});
