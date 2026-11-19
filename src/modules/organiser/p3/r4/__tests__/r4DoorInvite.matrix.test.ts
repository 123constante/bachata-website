import { describe, expect, it } from 'vitest';
import { R4_DOOR_INVITE_COPY as C, r4DoorInviteOf, type R4DoorInviteIn } from '../r4DoorInviteModel';
import { DOOR_MINT_FAILED, DOOR_MINT_WHY } from '../../door/join/doorJoinModel';

/*
 * Board R4DoorInvite x prod shapes (survey 2026-11-18/19, counts only): 0 door invites and 0 door
 * seats exist; 110 series, 9 with no night coming up; pages have 1 to many events. Copy mints a link
 * on tap only; every answer of ticket_door_seat_invite_v1 maps to plain words.
 */
const TOKEN = 'b'.repeat(64);
const ev = (nextDate: string | null, name = 'Friday Social') => ({ id: 's1', name, nextDate });
const base: R4DoorInviteIn = { load: 'ready', event: ev('2026-11-20'), many: true, doorOn: true, occurrenceId: 'o1', mint: 'idle', origin: 'https://x.test' };
const no = (r: Exclude<keyof typeof DOOR_MINT_WHY, never>) => ({ result: r, token: null, expiresAt: null });

type Want = { load: string; pick: string | null; why: string | null; can: boolean; preview: string | null; pickable: boolean; link: string | null };
const CASES: Array<[string, Partial<R4DoorInviteIn>, Want]> = [
  ['next night known, not tapped yet', {}, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: null, can: true, preview: 's1', pickable: true, link: null }],
  ['one event on the page', { many: false }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: null, can: true, preview: 's1', pickable: false, link: null }],
  ['night id not found yet', { occurrenceId: null }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: C.noOccurrence, can: false, preview: 's1', pickable: true, link: null }],
  ['no night coming up', { event: ev(null), occurrenceId: null }, { load: 'ready', pick: 'Friday Social, no night coming up', why: C.noNight, can: false, preview: 's1', pickable: true, link: null }],
  ['no name yet', { event: ev('2026-11-20', '  ') }, { load: 'ready', pick: 'No name yet, Friday 20 November', why: null, can: true, preview: 's1', pickable: true, link: null }],
  ['ticketing off: no door preview', { doorOn: false }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: null, can: true, preview: null, pickable: true, link: null }],
  ['making the link', { mint: 'running' }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: null, can: false, preview: 's1', pickable: true, link: null }],
  ['made', { mint: { result: 'ok', token: TOKEN, expiresAt: '2026-11-21T11:30:00Z' } }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: null, can: true, preview: 's1', pickable: true, link: `https://x.test/door/join/${TOKEN}` }],
  ['call failed', { mint: 'failed' }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: DOOR_MINT_FAILED, can: true, preview: 's1', pickable: true, link: null }],
  ['not_allowed', { mint: no('not_allowed') }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: DOOR_MINT_WHY.not_allowed, can: true, preview: 's1', pickable: true, link: null }],
  ['organiser_ambiguous', { mint: no('organiser_ambiguous') }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: DOOR_MINT_WHY.organiser_ambiguous, can: true, preview: 's1', pickable: true, link: null }],
  ['occurrence_not_live', { mint: no('occurrence_not_live') }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: DOOR_MINT_WHY.occurrence_not_live, can: true, preview: 's1', pickable: true, link: null }],
  ['occurrence_ended', { mint: no('occurrence_ended') }, { load: 'ready', pick: 'Friday Social, Friday 20 November', why: DOOR_MINT_WHY.occurrence_ended, can: true, preview: 's1', pickable: true, link: null }],
  ['no event on the page', { event: null }, { load: 'none', pick: null, why: C.none, can: false, preview: null, pickable: false, link: null }],
  ['loading', { load: 'loading' }, { load: 'loading', pick: null, why: null, can: false, preview: null, pickable: false, link: null }],
  ['could not load', { load: 'error' }, { load: 'error', pick: null, why: null, can: false, preview: null, pickable: false, link: null }],
];

describe('R4DoorInvite model x shape', () => {
  it.each(CASES)('%s', (_n, over, want) => {
    const m = r4DoorInviteOf({ ...base, ...over });
    expect({ load: m.load, pick: m.pick, why: m.copyWhy, can: m.canCopy, preview: m.previewFor, pickable: m.pickable, link: m.link?.url ?? null }).toEqual(want);
  });
  it('the facts are the server window and the names-only screen', () => {
    expect(r4DoorInviteOf(base).facts).toEqual(['Access ends 12 hours after the event.', 'They see names only, never money.']);
  });
  it('the LINK card says when access ends, in London time', () => {
    expect(r4DoorInviteOf({ ...base, mint: { result: 'ok', token: TOKEN, expiresAt: '2026-11-21T11:30:00Z' } }).link?.ends).toBe('Saturday 21 November, 11:30am');
  });
  it('the old "not ready yet" copy is gone', () => {
    expect(JSON.stringify(C)).not.toMatch(/not ready yet/);
  });
});
