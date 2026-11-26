import { describe, expect, it } from 'vitest';
import { rowOf, type HomeSeriesRow } from '../../data/home';
import { todoSeriesIdsOf } from '../../model/strip';
import type { OrganiserHome } from '@/modules/organiser/shared/selfServeApi';
import { R4_EMPTY_HOME, R4_WAIT_CAP, inviteDateLabel, r4AloneOf, r4WaitingOf } from '../r4Model';
import type { WaitingInvite } from '../../v2/ClassInvites';

const TODAY = '2026-11-18';
type Shape = { lifecycle: string; venue: string | null; cover: boolean; dates: readonly string[]; cancelledUp?: number; format?: string };

/**
 * Prod survey 2026-11-18 (counts only, event_series_p5 x event_occurrence_p5, archived left out):
 * draft no venue no cover no dates 4, draft no venue no cover with dates 7, draft venue no cover 1,
 * draft venue + cover 1, live venue + cover with dates 44, live no dates 28, live no dates with only
 * cancelled dates ahead 1, paused 3, ended 24. Pages: 52, 8 with no events at all; to-dos per page
 * 0 (18 pages), 1 (16), 2 (5), 3 (1), 5 (1), 11 (1). Team size 1 on 40 pages, 2 on 11, 3 on 1.
 * Open join requests: 3.
 */
function series(id: string, s: Shape): HomeSeriesRow {
  return {
    id, name: `Event ${id}`, lifecycle_status: s.lifecycle, format: s.format ?? 'recurring', category: null,
    default_venue_name: s.venue, default_cover_image_url: s.cover ? 'https://x/c.jpg' : null, upcoming_count: s.dates.length,
    cancelled_upcoming_count: s.cancelledUp ?? 0,
    next_dates: s.dates.map((d) => ({ occurrence_date: d, status: 'scheduled', starts_at: `${d}T21:00:00Z`, start_time: '21:00', venue_name: null })),
  } as unknown as HomeSeriesRow;
}
function page(shapes: Record<string, Shape>) {
  const list = Object.entries(shapes).map(([id, s]) => series(id, s));
  const home = { today: TODAY, organisers: [{ id: 'p', name: 'Page', role: 'owner', series: list }] } as unknown as OrganiserHome;
  return { rows: list.map((s) => rowOf(s, TODAY)), todoIds: todoSeriesIdsOf(home, 'p') };
}
const one = (s: Shape, requests: { requestId: string; requesterEmail: string | null }[] | null = null) => {
  const p = page({ a: s });
  return r4WaitingOf({ ...p, requests, editor: true });
};

describe('R4 Home "things waiting for you": every prod shape gives the honest item or none', () => {
  it.each([
    ['draft, no venue, no dates', { lifecycle: 'draft', venue: null, cover: false, dates: [] }, 'place', 'Add place'],
    ['draft, no venue, with dates', { lifecycle: 'draft', venue: null, cover: false, dates: ['2026-11-21'] }, 'place', 'Add place'],
    ['draft with venue, no cover', { lifecycle: 'draft', venue: 'Soho', cover: false, dates: [] }, 'event', 'Open'],
    ['draft with venue and cover', { lifecycle: 'draft', venue: 'Soho', cover: true, dates: [] }, 'event', 'Open'],
    ['live recurring, no dates coming up', { lifecycle: 'live', venue: 'Soho', cover: true, dates: [] }, 'dates', 'Add dates'],
    ['live with dates, no cover', { lifecycle: 'live', venue: 'Soho', cover: false, dates: ['2026-11-20'] }, 'photo', 'Add photo'],
  ] as const)('%s', (_c, s, go, action) => {
    const m = one(s as Shape);
    expect(m.items).toHaveLength(1);
    expect(m.items[0].go).toBe(go);
    expect(m.items[0].action).toBe(action);
    expect(m.items[0].title).toBe('Event a');
    expect(m.heading).toBe('1 thing waiting for you');
  });

  it.each([
    ['live with dates and cover', { lifecycle: 'live', venue: 'Soho', cover: true, dates: ['2026-11-20'] }],
    ['live, only cancelled dates ahead (never a to-do)', { lifecycle: 'live', venue: 'Soho', cover: true, dates: [], cancelledUp: 2 }],
    ['cancelled series', { lifecycle: 'cancelled', venue: 'Soho', cover: true, dates: [] }],
    ['ended', { lifecycle: 'ended', venue: 'Soho', cover: true, dates: [] }],
    ['paused with dates', { lifecycle: 'paused', venue: 'Soho', cover: true, dates: ['2026-11-22'] }],
    ['live one-off run its course', { lifecycle: 'live', venue: 'Soho', cover: true, dates: [], format: 'one_off' }],
  ] as const)('%s: nothing waiting', (_c, s) => {
    expect(one(s as Shape).items).toEqual([]);
  });

  it('join requests come after events, with the email and Answer; a blank email reads Someone', () => {
    const m = one({ lifecycle: 'draft', venue: null, cover: false, dates: [] }, [
      { requestId: 'q1', requesterEmail: 'jan@example.com' }, { requestId: 'q2', requesterEmail: '  ' },
    ]);
    expect(m.items.map((x) => x.go)).toEqual(['place', 'answer', 'answer']);
    expect(m.items[1]).toMatchObject({ title: 'jan@example.com asked to join', detail: 'Pick a role or say no.', action: 'Answer', id: 'q1' });
    expect(m.items[2].title).toBe('Someone asked to join');
    expect(m.heading).toBe('3 things waiting for you');
  });

  it('requests not loaded or failed: events only; a viewer who may not answer sees no requests', () => {
    expect(one({ lifecycle: 'live', venue: 'Soho', cover: true, dates: [] }, null).items).toHaveLength(1);
    const p = page({ a: { lifecycle: 'live', venue: 'Soho', cover: true, dates: ['2026-11-20'] } });
    expect(r4WaitingOf({ ...p, requests: [{ requestId: 'q', requesterEmail: 'a@b.c' }], editor: false }).items).toEqual([]);
  });

  it('the page with 11 to-dos lists the cap and says how many more', () => {
    const shapes: Record<string, Shape> = {};
    for (let k = 0; k < 11; k += 1) shapes[`s${k}`] = { lifecycle: 'draft', venue: null, cover: false, dates: [] };
    const m = r4WaitingOf({ ...page(shapes), requests: [], editor: true });
    expect(m.heading).toBe('11 things waiting for you');
    expect(m.items).toHaveLength(R4_WAIT_CAP);
    expect(m.more).toBe(11 - R4_WAIT_CAP);
  });

  it('a page with nothing to do: no items (the section is hidden)', () => {
    expect(r4WaitingOf({ rows: [], todoIds: new Set(), requests: [], editor: true })).toEqual({ heading: '0 things waiting for you', items: [], more: 0 });
  });
});

describe('R4 EmptyHome (no events at all): board words and the "Only you so far" row', () => {
  it('board copy', () => {
    expect(R4_EMPTY_HOME.title).toBe('No events yet');
    expect(R4_EMPTY_HOME.add).toBe('Add your first night');
    expect(R4_EMPTY_HOME.steps).toHaveLength(3);
  });
  it.each([
    ['team of 1 (40 pages), read in', { teamReady: true, members: 1, editor: true }, true],
    ['team of 2 (11 pages)', { teamReady: true, members: 2, editor: true }, false],
    ['team of 3 (1 page)', { teamReady: true, members: 3, editor: true }, false],
    ['team read still loading or failed', { teamReady: false, members: 1, editor: true }, false],
    ['contributor viewer', { teamReady: true, members: 1, editor: false }, false],
  ] as const)('%s', (_c, i, shown) => {
    expect(r4AloneOf(i)).toBe(shown);
  });
});

describe('R4 Home waiting list: invited class teachers who have not joined', () => {
  const inv = (id: string, over: Partial<WaitingInvite> = {}): WaitingInvite => ({
    invite_id: id, display_name: 'Anna Lopez', series_id: 's1', event_name: 'Friday Social', class_title: 'Salsa basics',
    next_date: '2026-12-04', last_sent_at: '2026-11-20T10:00:00Z', status: 'open', ...over,
  });
  const todo = () => page({ a: { lifecycle: 'draft', venue: null, cover: false, dates: [] } });

  it('date label is the full weekday, day and month (Europe/London, no year)', () => {
    expect(inviteDateLabel('2026-12-04')).toBe('Friday 4 December');
    expect(inviteDateLabel('2026-12-03')).toBe('Thursday 3 December');
    expect(inviteDateLabel('2026-07-01')).toBe('Wednesday 1 July');
  });
  it('one row per invite with the board words', () => {
    const m = r4WaitingOf({ rows: [], todoIds: new Set(), requests: null, editor: true, invites: [inv('v1')] });
    expect(m.items).toEqual([{
      key: 'i-v1', title: "Anna Lopez hasn't joined yet", detail: 'Teaching Salsa basics at Friday Social on Friday 4 December.',
      action: 'Resend', go: 'resend', id: 'v1',
    }]);
    expect(m.heading).toBe('1 thing waiting for you');
  });
  it('an expired invite says so', () => {
    const m = r4WaitingOf({ rows: [], todoIds: new Set(), requests: null, editor: true, invites: [inv('v1', { status: 'expired' })] });
    expect(m.items[0].detail).toBe('Teaching Salsa basics at Friday Social on Friday 4 December. Their link has expired.');
  });
  it('order: event to-dos, then invites, then join requests', () => {
    const m = r4WaitingOf({ ...todo(), requests: [{ requestId: 'q1', requesterEmail: 'x@y.z' }], editor: true, invites: [inv('v1'), inv('v2')] });
    expect(m.items.map((i) => i.go)).toEqual(['place', 'resend', 'resend', 'answer']);
    expect(m.heading).toBe('4 things waiting for you');
  });
  it('invites count in the cap and the "more" number', () => {
    const invites = Array.from({ length: 7 }, (_, k) => inv(`v${k}`));
    const m = r4WaitingOf({ rows: [], todoIds: new Set(), requests: null, editor: true, invites });
    expect(m.heading).toBe('7 things waiting for you');
    expect(m.items).toHaveLength(R4_WAIT_CAP);
    expect(m.more).toBe(7 - R4_WAIT_CAP);
  });
  it('null or missing invites change nothing', () => {
    const a = r4WaitingOf({ ...todo(), requests: null, editor: true });
    expect(r4WaitingOf({ ...todo(), requests: null, editor: true, invites: null })).toEqual(a);
    expect(r4WaitingOf({ ...todo(), requests: null, editor: true, invites: [] })).toEqual(a);
  });
});
