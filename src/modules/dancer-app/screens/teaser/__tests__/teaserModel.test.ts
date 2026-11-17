import { describe, expect, it } from 'vitest';
import { admitsViewOnly } from '../../../gate/viewOnly';
import { LOCKED_ROWS, TEASER_PATHS, greetingFor, nightDate, teaserActive, ticketLine } from '../teaserModel';

describe('teaserActive', () => {
  const cases: [boolean, boolean, boolean, boolean][] = [
    [false, false, false, false], [false, true, true, false], [true, false, true, false],
    [true, true, false, false], [true, true, true, true],
  ];
  it.each(cases)('teaser=%s ticketing=%s viewOnly=%s -> %s', (teaserFlag, ticketingFlag, viewOnly, want) => {
    expect(teaserActive({ teaserFlag, ticketingFlag, viewOnly })).toBe(want);
  });
});

describe('admitsViewOnly with the teaser flag', () => {
  it('flag off: only /app/tickets, exactly as before', () => {
    expect(admitsViewOnly('/app/tickets', true, false)).toBe(true);
    for (const p of TEASER_PATHS) expect(admitsViewOnly(p, true, false)).toBe(false);
    expect(admitsViewOnly('/app/tickets', true)).toBe(true);
  });
  it('welcome is admitted only with the teaser on (Continue reaches onboarding)', () => {
    expect(admitsViewOnly('/app/welcome', true, true)).toBe(true);
    expect(admitsViewOnly('/app/Welcome/', true, true)).toBe(true);
    expect(admitsViewOnly('/app/welcome', true, false)).toBe(false);
  });
  it('flag on: the four tabs too, never edit / photo / page', () => {
    for (const p of TEASER_PATHS) expect(admitsViewOnly(p + '/', true, true)).toBe(true);
    for (const p of ['/app/me/edit', '/app/me/photo', '/app/page']) expect(admitsViewOnly(p, true, true)).toBe(false);
  });
  it('ticketing off: nothing, whatever the teaser flag says', () => {
    for (const p of ['/app/tickets', '/app/welcome', ...TEASER_PATHS]) expect(admitsViewOnly(p, false, true)).toBe(false);
  });
});

describe('greeting', () => {
  it('uses the first name from auth metadata, else Hi there', () => {
    expect(greetingFor({ first_name: ' Ana ' })).toBe('Hi Ana');
    expect(greetingFor({ first_name: '' })).toBe('Hi there');
    expect(greetingFor({ first_name: 42 })).toBe('Hi there');
    expect(greetingFor(undefined)).toBe('Hi there');
  });
});

describe('copy', () => {
  it('night date matches the door view', async () => {
    const { doorDate } = await import('../../tickets/cardKit');
    for (const d of ['2026-11-21', '2027-01-03', null, 'soon']) expect(nightDate(d)).toBe(doorDate(d));
  });
  it('ticket line', () => {
    expect(ticketLine('Full pass', 'Sat 21 Nov 2026')).toBe('Sat 21 Nov 2026 \u00B7 Full pass');
    expect(ticketLine('Full pass', null)).toBe('Full pass');
  });
  it('every locked row says what it is', () => {
    for (const rows of Object.values(LOCKED_ROWS)) for (const r of rows) expect(r.title.length && r.line.length).toBeTruthy();
  });
});
