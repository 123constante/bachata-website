import { describe, expect, it } from 'vitest';
import { nightsOfChoice } from '../r4Nights';

const base = { id: 's1', name: 'Series', kind: 'weekly', kindWord: 'Weekly', cover: null, upcoming: 0, sub: '', alsoRunBy: [], nextTime: '8pm', nextStart: null, place: null, status: { past: false, key: 'ok', label: 'Live' } };
const page = { id: 'o', name: 'P', role: 'owner', series: [] } as never;
const ev = (over: Record<string, unknown>) => ({ ...base, ...over }) as never;

describe('nightsOfChoice: every lifecycle x dates shape', () => {
  it.each([
    ['draft with a date', { lifecycle: 'draft', next: { date: '2026-11-20' }, event: { dates: [{ date: '2026-11-20', status: 'scheduled' }] } }, 1],
    ['draft with no date', { lifecycle: 'draft', next: null, event: { dates: [] } }, 0],
    ['hidden with a date', { lifecycle: 'paused', next: { date: '2026-11-20' }, event: { dates: [{ date: '2026-11-20', status: 'scheduled' }] } }, 1],
    ['live with two dates', { lifecycle: 'live', next: { date: '2026-11-20' }, upcoming: 2, event: { dates: [{ date: '2026-11-20', status: 'scheduled' }, { date: '2026-11-27', status: 'scheduled' }] } }, 2],
    ['live, one cancelled', { lifecycle: 'live', next: { date: '2026-11-20' }, upcoming: 1, event: { dates: [{ date: '2026-11-20', status: 'cancelled' }, { date: '2026-11-27', status: 'scheduled' }] } }, 2],
    ['live, all dates passed', { lifecycle: 'live', next: null, status: { past: true, key: 'ok', label: 'Ended' }, event: { dates: [{ date: '2026-01-01', status: 'scheduled' }] } }, 0],
  ])('%s', (_n, over, want) => {
    expect(nightsOfChoice({ event: ev(over), today: '2026-11-17', page }).length).toBe(want);
  });
  it('no event, no nights', () => {
    expect(nightsOfChoice({ event: null, today: '2026-11-17', page }).length).toBe(0);
  });
});
