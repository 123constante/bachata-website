// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPE_KEYS, ws, type ShapeKey } from './wsFixtures';
import { PUBLIC_PAGE_WHY, PUBLIC_PAGE_WHY_OTHER, publicPageOf } from '../../data/eventPage';
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

/** Each shape: the link's path, or the reason it is off. */
const EXPECT: Record<ShapeKey, { href: string } | { why: string }> = {
  weekly: { href: '/event/sensual-fridays' },
  over100: { href: '/event/sensual-fridays' },
  monthly: { href: '/event/sensual-fridays' },
  custom: { href: '/event/sensual-fridays' },
  course: { href: '/event/sensual-fridays' },
  courseDone: { href: '/event/sensual-fridays' },
  festival: { href: '/event/sensual-fridays' },
  oneoff: { href: '/event/sensual-fridays' },
  oneoffPast: { href: '/event/sensual-fridays' },
  tonight: { href: '/event/sensual-fridays' },
  paused: { why: PUBLIC_PAGE_WHY.paused },
  draft: { why: PUBLIC_PAGE_WHY.draft },
  draftReady: { why: PUBLIC_PAGE_WHY.draft },
  ended: { href: '/event/sensual-fridays' },
  archived: { why: PUBLIC_PAGE_WHY.archived },
  noSessions: { href: '/event/sensual-fridays' },
  noTime: { href: '/event/sensual-fridays' },
  emptyLineup: { href: '/event/sensual-fridays' },
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
    if ('href' in want) {
      const a = screen.getByTestId('p3-dancer-view');
      expect(a.getAttribute('href')).toBe(want.href);
      expect(a.getAttribute('target')).toBeNull();
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
  it('falls back to the id when a live series has no slug', () => {
    const w = ws('weekly');
    expect(publicPageOf({ ...w, series: { ...w.series, slug: null } }).href).toBe('/event/ser-1');
  });
  it('an unknown status is off with the plain reason', () => {
    const w = ws('weekly');
    expect(publicPageOf({ ...w, series: { ...w.series, lifecycle_status: 'pending_review' } })).toEqual({ href: null, why: PUBLIC_PAGE_WHY_OTHER });
  });
  it('no reason uses an HTML entity or points at a control', () => {
    for (const why of [...Object.values(PUBLIC_PAGE_WHY), PUBLIC_PAGE_WHY_OTHER]) expect(why).not.toMatch(/&\w+;|button|tap/i);
  });
});
