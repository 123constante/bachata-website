import { describe, expect, it } from 'vitest';
import type { RaffleNight } from '../../events/raffle/raffleModel';
import { RAFFLE_COPY, lockedTitle, r4RaffleOf } from '../r4RaffleModel';

const night = (o: Partial<RaffleNight>): RaffleNight => ({
  occurrenceId: 'o1', date: '2026-11-20', startLocal: '2026-11-20T21:00:00', chip: 'closed', raffleOn: false, entries: 0,
  locked: false, winner: null, canSet: true, refuseReason: null, ...o,
});
const owner = { canEdit: true, viewOnlyReason: null };
const viewer = { canEdit: false, viewOnlyReason: 'ask an owner' };

describe('R4 Raffle: every chip the read returns (organiser_raffle_nights_v1, admin #1576 not on prod)', () => {
  it.each([
    // [case, night, read, steps now index, entered, locked, story, pick why, action]
    ['raffle off (closed), owner', night({}), owner, -1, null, false, true, RAFFLE_COPY.pickOff, 'open'],
    ['open, nobody entered', night({ chip: 'open', raffleOn: true }), owner, 0, 0, false, false, RAFFLE_COPY.pickBefore, 'close'],
    ['locked, 23 entered (the board)', night({ chip: 'locked', raffleOn: true, entries: 23, locked: true }), owner, 1, 23, true, false, RAFFLE_COPY.pickBefore, 'message'],
    ['past with entries, waiting on our draw', night({ chip: 'past', raffleOn: true, entries: 9 }), owner, 2, 9, false, true, RAFFLE_COPY.pickPast, null],
    ['past, nobody entered', night({ chip: 'past', entries: 0 }), owner, -1, null, false, true, RAFFLE_COPY.pickOff, null],
    ['drawn', night({ chip: 'drawn', entries: 12, winner: { firstName: 'Ana', drawnAt: null, entriesAtDraw: 11 } }), owner, 3, 11, false, false, RAFFLE_COPY.pickDrawn, null],
    ['draft night', night({ chip: 'draft' }), owner, -1, null, false, true, RAFFLE_COPY.pickOff, null],
    ['cancelled night', night({ chip: 'cancelled' }), owner, -1, null, false, true, RAFFLE_COPY.pickOff, null],
    ['closed, view only', night({}), viewer, -1, null, false, true, RAFFLE_COPY.pickOff, 'open'],
  ] as const)('%s', (_c, n, read, now, entered, locked, hasStory, pickWhy, action) => {
    const m = r4RaffleOf(true, n, read);
    if (m.kind !== 'night') throw new Error('expected a night');
    expect(m.steps.map((s) => s.word)).toEqual(['Open', 'Entries', 'Closed', 'Winner']);
    expect(m.steps.findIndex((s) => s.state === 'now')).toBe(now);
    expect(m.steps.slice(0, Math.max(now, 0)).every((s) => s.state === 'done')).toBe(true);
    expect(m.entered).toBe(entered);
    expect(!!m.locked).toBe(locked);
    expect(!!m.story).toBe(hasStory);
    expect(m.pickWhy).toBe(pickWhy);
    expect(m.action?.action ?? null).toBe(action);
  });

  it('view only: the move is off and says why', () => {
    const m = r4RaffleOf(true, night({}), viewer);
    expect(m.kind === 'night' && m.action?.enabled).toBe(false);
    expect(m.kind === 'night' && m.action?.why).toMatch(/ask an owner/);
  });

  it('drawn with no name: never blank', () => {
    const m = r4RaffleOf(true, night({ chip: 'drawn', entries: 3 }), owner);
    expect(m.kind === 'night' && m.winner).toBe(RAFFLE_COPY.noName);
  });

  it('flag off: Coming soon, no read; no night in the read: none', () => {
    expect(r4RaffleOf(false, night({}), owner)).toEqual({ kind: 'soon' });
    expect(r4RaffleOf(true, null, owner)).toEqual({ kind: 'none' });
  });

  it('locked title counts people', () => {
    expect(lockedTitle(23)).toBe('Locked: 23 people have entered');
    expect(lockedTitle(1)).toBe('Locked: 1 person has entered');
  });
});
