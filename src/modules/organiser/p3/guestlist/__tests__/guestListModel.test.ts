import { describe, expect, it } from 'vitest';
import { doorLine, draftOf, editBlock, emptyWords, parseRead, reasonWords, scanWords, settingsArgs, settingsError, stateBanner, statusLine, type GuestListView } from '../guestListModel';
import { tokenOf } from '../guestListApi';

const night = (o: Record<string, unknown> = {}) => ({ occurrence_id: 'o1', enabled: true, capacity_max: null, cutoff_time: null, closed: false, full: false, past: false, cancelled: false, ...o });
const raw = (o: Record<string, unknown> = {}, n: Record<string, unknown> = {}, c: Record<string, unknown> = {}) => ({
  ok: true, role: 'owner', can_edit: true, can_check_in: true, read_only_reason: null, night: night(n),
  counts: { names: 9, in: 0, places_left: null, ...c }, total: 9, entries: [{ id: 'e1', first_name: 'Ana', status: 'active', is_permanent: false, added_via: 'self', checked_in_at: null }], ...o,
});
const view = (o?: Record<string, unknown>, n?: Record<string, unknown>, c?: Record<string, unknown>) => parseRead(raw(o, n, c)) as GuestListView;

// screen x shape: every shape the brief names, with the one sentence each screen must say.
const SHAPES: Array<[string, GuestListView, { banner: RegExp | null; block: RegExp | null; status: RegExp }]> = [
  ['empty (0 names)', view({ entries: [], total: 0 }, {}, { names: 0 }), { banner: null, block: null, status: /^On · 0 names$/ }],
  ['median (9)', view(), { banner: null, block: null, status: /^On · 9 names$/ }],
  ['huge (63, 41 in)', view({ total: 63 }, { capacity_max: 70, cutoff_time: '22:00' }, { names: 63, in: 41, places_left: 7 }), { banner: null, block: null, status: /7 of 70 places left · closes 22:00/ }],
  ['off', view({}, { enabled: false }), { banner: /Turn the switch on/, block: null, status: /^Off for this night$/ }],
  ['full', view({}, { full: true, capacity_max: 60 }, { places_left: 0 }), { banner: /Every place is taken/, block: null, status: /0 of 60 places left/ }],
  ['closed', view({}, { closed: true, cutoff_time: '22:00' }), { banner: /Sign-up is closed/, block: null, status: /closed/ }],
  ['past', view({ can_edit: false, read_only_reason: 'past' }, { past: true }), { banner: /This night is over/, block: /This night is over/, status: /^On/ }],
  ['cancelled', view({ can_edit: false, read_only_reason: 'cancelled' }, { cancelled: true }), { banner: /cancelled/, block: /cancelled/, status: /^On/ }],
  ['contributor', view({ role: 'contributor', can_edit: false, can_check_in: false, read_only_reason: 'view_only' }), { banner: null, block: /Contributors can look/, status: /^On/ }],
];

describe('guest list model, screen x shape', () => {
  it.each(SHAPES)('%s', (_n, v, want) => {
    expect(statusLine(v)).toMatch(want.status);
    const b = stateBanner(v);
    if (want.banner) expect(b).toMatch(want.banner); else expect(b).toBeNull();
    const e = editBlock(v);
    if (want.block) expect(e).toMatch(want.block); else expect(e).toBeNull();
  });
  it('every blocked shape gives a reason; nothing is disabled without words', () => {
    for (const [, v] of SHAPES) if (!v.canEdit) expect(editBlock(v)).toBeTruthy();
  });
  it('empty states say what to do', () => {
    expect(emptyWords(SHAPES[0][1], false)).toMatch(/Add one above/);
    expect(emptyWords(SHAPES[0][1], true)).toMatch(/Clear the search/);
    expect(emptyWords(view({ can_edit: false }), false)).toBe('No names yet.');
  });
});

describe('parsing', () => {
  it('a refusal keeps its reason, a malformed answer is a refusal, not a crash', () => {
    expect(parseRead({ ok: false, reason: 'not_on_team' })).toEqual({ ok: false, reason: 'not_on_team' });
    expect(parseRead(null)).toEqual({ ok: false, reason: 'unknown' });
  });
  it('maps entries; Every week, waitlist, team and checked in', () => {
    const v = view({ entries: [{ id: 'a', first_name: 'Sol', status: 'waitlist', is_permanent: true, added_via: 'organiser', checked_in_at: '2026-11-13T20:00:00Z' }, { first_name: 'no id' }] });
    expect(v.entries).toEqual([{ id: 'a', firstName: 'Sol', everyWeek: true, waitlist: true, byTeam: true, checkedIn: true }]);
  });
  it('every refusal reason the RPCs return has words that say nothing changed or why', () => {
    for (const r of ['not_signed_in', 'night_not_found', 'not_on_team', 'view_only', 'cancelled', 'past', 'bad_capacity', 'bad_cutoff_time', 'name_required', 'name_too_long', 'duplicate_name', 'not_restorable', 'not_on_list', 'not_found', 'other_night']) {
      expect(reasonWords(r)).not.toMatch(/did not work/);
    }
    expect(reasonWords('weird')).toMatch(/Nothing was changed/);
  });
});

describe('settings', () => {
  const v = view({}, { capacity_max: 60, cutoff_time: '22:00' });
  it('saving an untouched form sends nothing', () => {
    expect(settingsArgs(v, draftOf(v))).toBeNull();
    expect(settingsArgs(v, { places: ' 60 ', closes: '22:00' })).toBeNull();
  });
  it('a change sends it; blank places = 0 (no limit), blank closes = none', () => {
    expect(settingsArgs(v, { places: '80', closes: '22:00' })).toEqual({ capacity: 80, cutoff: '22:00' });
    expect(settingsArgs(v, { places: '', closes: '' })).toEqual({ capacity: 0, cutoff: '' });
  });
  it('bad values are named before anything is sent', () => {
    expect(settingsError({ places: '-1', closes: '' })).toMatch(/0 to 100000/);
    expect(settingsError({ places: '1000000', closes: '' })).toMatch(/0 to 100000/);
    expect(settingsError({ places: '', closes: '25:00' })).toMatch(/22:00/);
    expect(settingsError({ places: '10', closes: '09:30' })).toBeNull();
  });
});

describe('door and scan', () => {
  it('says the count', () => { expect(doorLine({ names: 63, inCount: 41, placesLeft: null })).toBe('41 of 63 in'); });
  it('scan sentences', () => {
    expect(scanWords({ ok: true, firstName: 'Ana', alreadyIn: false, counts: { names: 63, inCount: 41, placesLeft: null } })).toBe('Ana is in. 41 of 63 in.');
    expect(scanWords({ ok: true, firstName: 'Ana', alreadyIn: true })).toBe('Ana was already in.');
    expect(scanWords({ ok: false, reason: 'other_night' })).toMatch(/different night/);
  });
  it('a QR holds the token bare or in a link', () => {
    const t = '0b0f6c1e-1b0a-4f0e-9a55-3a1d2c4e5f60';
    expect(tokenOf(t)).toBe(t);
    expect(tokenOf(`https://x.example/q/${t.toUpperCase()}?a=1`)).toBe(t);
    expect(tokenOf('TICKET-123')).toBeNull();
  });
});
