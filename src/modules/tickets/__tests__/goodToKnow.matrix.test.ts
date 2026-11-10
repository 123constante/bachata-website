import { describe, expect, it } from 'vitest';
import { buildChips, type GoodToKnowInput } from '../goodToKnow';
import { ticketSymbol } from '../ticketSymbol';

const base: GoodToKnowInput = {
  startIso: null, endIso: null, programmeStartIso: null, programmeEndIso: null,
  idRequired: null, bar: null, cloakroom: null, facilities: [], floorType: null,
  musicStyles: [], latestCloseIso: null, parking: null, timeZone: 'Europe/London',
};
const texts = (i: Partial<GoodToKnowInput>) => buildChips({ ...base, ...i }).map((c) => c.text);

describe('buildChips shapes', () => {
  it('all known, fixed order', () => {
    expect(texts({
      startIso: '2026-11-13T20:00:00Z', endIso: '2026-11-14T01:00:00Z', idRequired: true, bar: true, cloakroom: true,
      floorType: 'wood', musicStyles: ['Bachata', 'Salsa'], latestCloseIso: '2026-11-13T20:00:00Z', parking: 'Parking nearby',
    })).toEqual(['5 hours', 'Bring photo ID', 'Bar', 'Cloakroom', 'Wooden floor', 'Bachata · Salsa', 'Tickets until Friday 13 November, 8pm', 'Parking nearby']);
  });
  it('only the deadline known falls back to event start', () => {
    expect(texts({ startIso: '2026-11-15T16:00:00Z' })).toEqual(['Tickets until Sunday 15 November, 4pm']);
  });
  it('nothing known gives no chips (block hidden)', () => {
    expect(buildChips(base)).toEqual([]);
  });
  it('false bar/cloakroom are hidden, never "No bar"', () => {
    expect(texts({ bar: false, cloakroom: false })).toEqual([]);
  });
  it('facilities list is the fallback for bar and cloakroom', () => {
    expect(texts({ facilities: ['Bar', 'Cloakroom'] })).toEqual(['Bar', 'Cloakroom']);
  });
  it('length falls back to the programme', () => {
    expect(texts({ programmeStartIso: '2026-11-13T20:00:00Z', programmeEndIso: '2026-11-13T22:30:00Z' })).toEqual(['2 hours 30 minutes']);
  });
  it('music is capped at three then +N', () => {
    expect(texts({ musicStyles: ['A', 'B', 'C', 'D', 'E'] })).toEqual(['A · B · C +2']);
  });
  it('ID chip is marked must; unknown floor shows saved text; long parking note kept whole', () => {
    const note = 'Pay and display on Dean Street, free after 6.30pm and all day Sunday';
    const c = buildChips({ ...base, idRequired: true, floorType: 'Cork', parking: note });
    expect(c.find((x) => x.kind === 'id')?.must).toBe(true);
    expect(c.map((x) => x.text)).toEqual(['Bring photo ID', 'Cork', note]);
  });
});

describe('ticketSymbol', () => {
  it.each([
    ['Party', 1200, 'party'], ['Class + party', 1500, 'both'], ['Beginners class', 800, 'class'],
    ['VIP table', 3000, 'vip'], ['Early bird · Party', 800, 'early'], ['Entry', 1000, 'generic'],
    ['Free ticket', 0, 'free'], ['Party', 0, 'free'], ['Partying', 500, 'generic'],
  ])('%s at %d is %s', (n, p, s) => expect(ticketSymbol(n, p)).toBe(s));
});
