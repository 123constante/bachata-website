import { describe, expect, it, vi } from 'vitest';
import {
  OWNER_UPSERT_KEYS,
  basicsPayload,
  hasBasicsChanges,
  ownerPassesFromStored,
  upsertCommand,
  type BasicsDraft,
} from '../seriesCommands';
import {
  basicsFormFromSeries,
  formToDraft,
  instagramUrlOk,
  passRowsProblem,
  setTimeDoneCopy,
  type WorkspaceSeries,
} from '../seriesModel';
import { commandErrorMessage } from '../selfServeErrors';
import { isDateTimeSession, parseProgramItems, type RpcItem } from '../../event-page/sections/EventScheduleGrid';

// EventScheduleGrid's hooks import the client; the parsers under test never call it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

// Lever 2 W-PR for admin D8 (20261109180000_p5_owner_writes_time_price_instagram_v1.sql):
// the price list and the Instagram link from the series form, a date's own time on a
// series with no programme times, no masterclass echo, and the reason-needs-a-cancelled-date copy.

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const base: BasicsDraft = {
  name: 'Friday Party',
  description: '',
  venueId: 'venue-1',
  startTime: '21:00',
  durationMinutes: 240,
  ticketUrl: '',
  coverImageUrl: '',
  instagramUrl: '',
  passes: [],
};

const series = (over: Partial<WorkspaceSeries> = {}): WorkspaceSeries => ({
  id: 'ser-1', name: 'Friday Party', slug: null, format: 'recurring', category: 'party',
  lifecycle_status: 'live', version: 3, default_venue_id: 'venue-1', default_local_start_time: '21:00:00',
  default_duration: '04:00:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: '2026-10-09', instagram_url: null, passes: null,
  created_at: null, recurrence_rule: null, removed_dates: [], ...over,
});

describe('D8: the two new owner keys', () => {
  it('the mirror carries default_passes and instagram_url', () => {
    expect(OWNER_UPSERT_KEYS).toContain('default_passes');
    expect(OWNER_UPSERT_KEYS).toContain('instagram_url');
  });

  it('sends instagram_url only when it changed; blank clears', () => {
    expect(basicsPayload(base, { ...base })).toEqual({ name: 'Friday Party' });
    expect(basicsPayload(base, { ...base, instagramUrl: ' https://www.instagram.com/fridayparty ' }))
      .toEqual({ name: 'Friday Party', instagram_url: 'https://www.instagram.com/fridayparty' });
    const withLink = { ...base, instagramUrl: 'https://instagram.com/x' };
    expect(basicsPayload(withLink, { ...withLink, instagramUrl: '' })).toEqual({ name: 'Friday Party', instagram_url: '' });
  });

  it('sends the whole price list only when it changed, owner-shaped; [] clears', () => {
    const passes = [{ id: ID_A, name: ' Entry ', price: 12.5, currency: 'GBP' as const }];
    expect(basicsPayload(base, { ...base, passes })).toEqual({
      name: 'Friday Party',
      default_passes: [{ id: ID_A, name: 'Entry', price: 12.5, currency: 'GBP' }],
    });
    const priced = { ...base, passes: [{ id: ID_A, name: 'Entry', price: 10 }] };
    expect(basicsPayload(priced, { ...priced })).toEqual({ name: 'Friday Party' });
    expect(hasBasicsChanges(priced, { ...priced, passes: [] })).toBe(true);
    expect(basicsPayload(priced, { ...priced, passes: [] })).toEqual({ name: 'Friday Party', default_passes: [] });
  });

  it('never sends a price list the team shaped (null)', () => {
    expect(basicsPayload({ ...base, passes: null }, { ...base, passes: null })).toEqual({ name: 'Friday Party' });
  });

  it('a create draft (no instagram / passes fields) emits neither key', () => {
    const { instagramUrl: _i, passes: _p, ...plain } = base;
    expect(basicsPayload(plain, { ...plain, name: 'X' })).toEqual({ name: 'X' });
  });
});

describe('D8: ownerPassesFromStored', () => {
  it('reads an owner-shaped list, numeric-string prices as numbers', () => {
    expect(ownerPassesFromStored(null)).toEqual([]);
    expect(ownerPassesFromStored([{ id: ID_A, name: 'Entry', price: '12.50', currency: 'GBP' }, { id: ID_B, name: 'Free before 22:00', price: null }]))
      .toEqual([{ id: ID_A, name: 'Entry', price: 12.5, currency: 'GBP' }, { id: ID_B, name: 'Free before 22:00', price: null }]);
  });

  it('refuses (null) a list the team shaped or the server would refuse', () => {
    expect(ownerPassesFromStored([{ id: ID_A, name: 'Full pass', price: 90, tier: 'early', covers_days: [1, 2] }])).toBeNull();
    expect(ownerPassesFromStored([{ id: 'pass-1', name: 'Entry', price: 10 }])).toBeNull();
    expect(ownerPassesFromStored([{ id: ID_A, name: 'A', price: 1 }, { id: ID_A, name: 'B', price: 2 }])).toBeNull();
    expect(ownerPassesFromStored([{ id: ID_A, name: 'Entry', price: 'ten' }])).toBeNull();
    expect(ownerPassesFromStored([{ id: ID_A, name: 'Entry', price: 1, currency: 'CHF' }])).toBeNull();
    expect(ownerPassesFromStored({ entry: 1 })).toBeNull();
  });

  it('the form round-trips the stored list without a change', () => {
    const s = series({ passes: [{ id: ID_A, name: 'Entry', price: 10, currency: 'GBP' }], instagram_url: 'https://www.instagram.com/fp' });
    const form = basicsFormFromSeries(s);
    expect(form.passes).toEqual([{ id: ID_A, name: 'Entry', price: '10', currency: 'GBP' }]);
    expect(form.instagramUrl).toBe('https://www.instagram.com/fp');
    const draft = formToDraft(form);
    expect(basicsPayload(draft, formToDraft({ ...form }))).toEqual({ name: 'Friday Party' });
    expect(basicsPayload(draft, formToDraft({ ...form, passes: [{ ...form.passes![0], price: '' }] })))
      .toEqual({ name: 'Friday Party', default_passes: [{ id: ID_A, name: 'Entry', price: null, currency: 'GBP' }] });
  });

  it('a team-shaped list reads as not editable', () => {
    expect(basicsFormFromSeries(series({ passes: [{ id: ID_A, name: 'Full', price: 1, tier: 'x' }] })).passes).toBeNull();
  });
});

describe('D8: form checks match the server rules', () => {
  it('passRowsProblem', () => {
    expect(passRowsProblem(null)).toBeNull();
    expect(passRowsProblem([{ id: ID_A, name: 'Entry', price: '12.50' }])).toBeNull();
    expect(passRowsProblem([{ id: ID_A, name: 'Entry', price: '' }])).toBeNull();
    expect(passRowsProblem([{ id: ID_A, name: ' ', price: '5' }])).toMatch(/name/);
    expect(passRowsProblem([{ id: ID_A, name: 'Entry', price: '12.505' }])).toMatch(/number/);
    expect(passRowsProblem([{ id: ID_A, name: 'Entry', price: '-1' }])).toMatch(/number/);
    expect(passRowsProblem(Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: 'x', price: '' })))).toMatch(/10/);
  });

  it('instagramUrlOk', () => {
    expect(instagramUrlOk('')).toBe(true);
    expect(instagramUrlOk('https://www.instagram.com/fridayparty')).toBe(true);
    expect(instagramUrlOk('http://Instagram.com/x')).toBe(true);
    expect(instagramUrlOk('https://instagram.com')).toBe(false);
    expect(instagramUrlOk('https://facebook.com/fridayparty')).toBe(false);
    expect(instagramUrlOk('@fridayparty')).toBe(false);
  });
});

describe('D8: category is never echoed outside the owner three', () => {
  it('upsertCommand drops a masterclass (or any non-owner) category', () => {
    expect(upsertCommand({ name: 'M', category: 'masterclass' })).toEqual({ kind: 'series.upsert', payload: { name: 'M' } });
    expect(upsertCommand({ name: 'M', category: null })).toEqual({ kind: 'series.upsert', payload: { name: 'M' } });
    expect(upsertCommand({ name: 'P', category: 'party' })).toEqual({ kind: 'series.upsert', payload: { name: 'P', category: 'party' } });
  });

  it('the basics form on a masterclass series sends no category', () => {
    const form = basicsFormFromSeries(series({ category: 'masterclass' }));
    const before = formToDraft(form);
    const cmd = upsertCommand(basicsPayload(before, formToDraft({ ...form, name: 'Renamed', instagramUrl: 'https://www.instagram.com/m' })));
    expect(cmd.payload).not.toHaveProperty('category');
    expect(cmd.payload).toEqual({ name: 'Renamed', instagram_url: 'https://www.instagram.com/m' });
  });
});

describe('D8: Change the time on a series with no programme times', () => {
  it('maps date_session_created to plain owner copy with the landed times', () => {
    const res = { ok: true, new_version: 2, data: { applied: { start: '22:30', end: '01:30' }, date_session_created: true } };
    const copy = setTimeDoneCopy('Fri 9 Oct', '22:30', res);
    expect(copy.title).toBe('Fri 9 Oct now has its own time: 22:30–01:30.');
    expect(copy.body).toMatch(/Only this date changes/);
    expect(copy.body).not.toMatch(/session/i);
  });

  it('reads the flag at the top level too, and keeps the old copy otherwise', () => {
    expect(setTimeDoneCopy('Fri', '23:00', { date_session_created: true, applied: { start: '23:00', end: '02:00' } }).title)
      .toBe('Fri now has its own time: 23:00–02:00.');
    expect(setTimeDoneCopy('Fri', '23:00', { ok: true, data: { shifted_added: 1 } }).title).toBe('Fri now starts at 23:00.');
    expect(setTimeDoneCopy('Fri', '23:00', undefined).title).toBe('Fri now starts at 23:00.');
  });
});

describe('D8: refusal copy', () => {
  it('a reason on a date that is not cancelled', () => {
    const text = commandErrorMessage({ message: 'permission_denied: occurrence.set_override cancellation_reason_label needs a cancelled date' });
    expect(text).toMatch(/cancelled date/);
    expect(text).not.toMatch(/permission_denied|cancellation_reason_label/);
    expect(text).not.toBe(commandErrorMessage({ message: 'permission_denied: something else' }));
  });

  it('the price list and the Instagram link', () => {
    expect(commandErrorMessage({ message: 'permission_denied: series.upsert default_passes entry id must be a uuid' })).toMatch(/prices/);
    expect(commandErrorMessage({ message: 'permission_denied: series.upsert instagram_url must be blank or an instagram.com link' })).toMatch(/Instagram/);
  });
});

describe('D8: the date-time session is not a schedule row ("Special tonight" stays for real additions)', () => {
  const row = (over: Partial<RpcItem>): RpcItem => ({
    id: 'a1', title: 'Friday Party', type: 'party', start_time: '2026-10-09T22:30:00', end_time: '2026-10-10T01:30:00',
    sort_order: -1, levels: [], room: null, people: [], section_id: null, section_kind: null, section_label: null,
    added_only: true, cancelled: false, ...over,
  } as RpcItem);

  it('drops the date-time session', () => {
    expect(isDateTimeSession(row({}))).toBe(true);
    expect(parseProgramItems([row({})])).toEqual([]);
  });

  it('keeps an admin-added session and its Special tonight flag', () => {
    const added = row({ id: 'a2', title: 'Guest workshop', sort_order: 0 });
    expect(isDateTimeSession(added)).toBe(false);
    const parsed = parseProgramItems([added]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].addedOnly).toBe(true);
  });

  it('keeps a sort_order -1 row that carries people, levels or a room, and any programme row', () => {
    expect(isDateTimeSession(row({ levels: ['beginner'] }))).toBe(false);
    expect(isDateTimeSession(row({ room: 'Main' }))).toBe(false);
    expect(isDateTimeSession(row({ added_only: false }))).toBe(false);
  });
});
