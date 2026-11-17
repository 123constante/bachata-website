import { describe, expect, it } from 'vitest';
import { admitsViewOnly } from '../../../gate/viewOnly';
import type { ProfileRead } from '../../tickets/profileIncomplete';
import { LOCKED_ROWS, TEASER_COPY, TEASER_PATHS, finishLineFor, greetingFor, nightDate, nightsHref, teaserState, ticketLine } from '../teaserModel';

const NO_PROFILE: ProfileRead = { status: 'no_profile', requiredDone: false };
const MID_SETUP: ProfileRead = { status: 'success', requiredDone: false };
const DONE: ProfileRead = { status: 'success', requiredDone: true };
const PENDING: ProfileRead = { status: 'pending', requiredDone: false };
const ERROR: ProfileRead = { status: 'error', requiredDone: false };
const on = { teaserFlag: true, ticketingFlag: true, viewOnly: false };

describe('teaserState', () => {
  it('on for an allowed person with an unfinished profile (prod: dancer_area_open = true, everyone allowed)', () => {
    expect(teaserState({ ...on, read: NO_PROFILE })).toBe('on');
    expect(teaserState({ ...on, read: MID_SETUP })).toBe('on');
  });
  it('off for a finished profile, and for a failed read (the real screens, as today)', () => {
    expect(teaserState({ ...on, read: DONE })).toBe('off');
    expect(teaserState({ ...on, read: ERROR })).toBe('off');
  });
  it('pending while the profile read is out', () => {
    expect(teaserState({ ...on, read: PENDING })).toBe('pending');
  });
  it('never for a view-only person: their onboarding calls raise 42501 area_closed', () => {
    for (const read of [NO_PROFILE, MID_SETUP, PENDING, DONE, ERROR]) expect(teaserState({ ...on, viewOnly: true, read })).toBe('off');
  });
  it('off with either flag off, whatever the profile', () => {
    for (const read of [NO_PROFILE, MID_SETUP, PENDING]) {
      expect(teaserState({ ...on, teaserFlag: false, read })).toBe('off');
      expect(teaserState({ ...on, ticketingFlag: false, read })).toBe('off');
    }
  });
});

describe('the teaser never widens the dancer-area gate', () => {
  it('a not-allowed person is still admitted to /app/tickets only (never the tabs, never welcome)', () => {
    expect(admitsViewOnly('/app/tickets', true)).toBe(true);
    for (const p of ['/app/welcome', ...TEASER_PATHS]) expect(admitsViewOnly(p, true)).toBe(false);
  });
});

describe('Finish card line', () => {
  it('says the ticket is booked only when real tickets are on the card', () => {
    expect(finishLineFor('tickets')).toBe(TEASER_COPY.finishLine);
    for (const k of ['none', 'loading', 'pending', 'processing', 'failed', 'qr_error', 'paid_email']) {
      expect(finishLineFor(k)).toBe(TEASER_COPY.finishLineNoTicket);
    }
  });
  it('never says bought or paid', () => {
    for (const s of [TEASER_COPY.finishLine, TEASER_COPY.finishLineNoTicket]) expect(s).not.toMatch(/bought|paid/i);
    expect(TEASER_COPY.finishLineNoTicket).not.toMatch(/ticket/i);
  });
});

describe('Home ticket link keeps the order', () => {
  const id = '0f8c3c1e-2b4a-4d6e-9f10-1a2b3c4d5e6f';
  it('carries ?o= (and free=1 with it) to Nights', () => {
    expect(nightsHref(`?o=${id}`)).toBe(`/app/nights?o=${id}`);
    expect(nightsHref(`?o=${id}&free=1&x=2`)).toBe(`/app/nights?o=${id}&free=1`);
  });
  it('plain Nights without a real order id', () => {
    expect(nightsHref('')).toBe('/app/nights');
    expect(nightsHref('?o=nope&free=1')).toBe('/app/nights');
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
