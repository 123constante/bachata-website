/**
 * The team picker's rules (teamPickerModel.ts, teamPickerAccess in teamModel.ts),
 * table-driven over every viewer role x the shapes production holds (survey of
 * 2026-10-12, read-only, counts only):
 *   - organisers: 41 with no member, 3 with one owner, 1 with two owners; no
 *     manager or contributor anywhere yet;
 *   - people the search can return: 6 (5 with no photo, all with a city), 4 more
 *     hidden for an unconfirmed email; no accented or long name among them, but 2
 *     of 166 dancer profiles have a non-ASCII name and 72 have no city, so those
 *     shapes are covered here before they reach the search;
 *   - the RPC caps at 8 rows and answers nothing under two letters.
 * The SAME functions the sheet calls: one mapping, never a copy in the JSX.
 */
import { describe, expect, it } from 'vitest';
import { teamPickerAccess, type TeamRole } from '@/modules/organiser/shared/teamModel';
import {
  MIN_QUERY,
  PICKER_COPY,
  SEARCH_LIMIT,
  addBlockedReason,
  addPicked,
  addRefusalCopy,
  addedMessage,
  inviteShare,
  listMessage,
  parseAddResult,
  parsePeople,
  personInitials,
  personSubline,
  rowActionLabel,
  rowState,
  searchTerm,
  teamCountLine,
  willAddLine,
  type PersonResult,
} from '../teamPickerModel';

const person = (id: string, name: string, extra: Partial<PersonResult> = {}): PersonResult => ({ profileId: id, name, photoUrl: null, city: 'London', ...extra });

describe('who gets the picker (teamPickerAccess): owner and admin only', () => {
  const ROLES: Array<[string, TeamRole | 'admin' | null | undefined, 'owner' | 'admin' | null]> = [
    ['owner', 'owner', 'owner'],
    ['admin (not an owner)', 'admin', 'admin'],
    ['manager', 'manager', null],
    ['contributor', 'contributor', null],
    ['not on the team (read refused)', null, null],
    ['signed out / not loaded', undefined, null],
  ];
  it.each(ROLES)('%s', (_n, role, want) => expect(teamPickerAccess(role)).toBe(want));
});

describe('search rows (parsePeople) over every row shape', () => {
  const ROWS: Array<[string, unknown, PersonResult[]]> = [
    ['no rows', [], []],
    ['not an array (an error body)', { message: 'x' }, []],
    ['null', null, []],
    ['photo and city', [{ profile_id: 'p1', display_name: 'Ana Ruiz', photo_url: 'https://cdn.example/a.jpg', city_name: 'London' }],
      [{ profileId: 'p1', name: 'Ana Ruiz', photoUrl: 'https://cdn.example/a.jpg', city: 'London' }]],
    ['no photo (5 of the 6 on prod)', [{ profile_id: 'p2', display_name: 'Marco', photo_url: null, city_name: 'Leeds' }],
      [{ profileId: 'p2', name: 'Marco', photoUrl: null, city: 'Leeds' }]],
    ['blank photo and no city', [{ profile_id: 'p3', display_name: 'Lee', photo_url: '  ', city_name: null }],
      [{ profileId: 'p3', name: 'Lee', photoUrl: null, city: null }]],
    ['accented name', [{ profile_id: 'p4', display_name: 'José Ñúñez-Pérez', photo_url: null, city_name: 'Málaga' }],
      [{ profileId: 'p4', name: 'José Ñúñez-Pérez', photoUrl: null, city: 'Málaga' }]],
    ['no name: dropped', [{ profile_id: 'p5', display_name: '', photo_url: null, city_name: 'London' }], []],
    ['no id: dropped', [{ display_name: 'Ghost' }], []],
    ['same id twice: once', [{ profile_id: 'p6', display_name: 'Ana' }, { profile_id: 'p6', display_name: 'Ana' }],
      [{ profileId: 'p6', name: 'Ana', photoUrl: null, city: null }]],
  ];
  it.each(ROWS)('%s', (_n, raw, want) => expect(parsePeople(raw)).toEqual(want));

  it('a very long name is kept whole (the row truncates it with CSS, never the data)', () => {
    const long = 'Maria Fernanda de los Ángeles Rodríguez-Villanueva Santamaría';
    expect(parsePeople([{ profile_id: 'p7', display_name: long }])[0].name).toBe(long);
  });
});

describe('what is sent: two letters at least (the RPC answers nothing below)', () => {
  const Q: Array<[string, string | null]> = [['', null], ['m', null], [' m ', null], ['ma', 'ma'], ['  Mar  ', 'Mar'], ['Jó', 'Jó'], ['😀', null], ['😀😀', '😀😀']];
  it.each(Q)('%j -> %j', (q, want) => expect(searchTerm(q)).toBe(want));
  it('MIN_QUERY and SEARCH_LIMIT mirror the RPC', () => { expect(MIN_QUERY).toBe(2); expect(SEARCH_LIMIT).toBe(8); });
});

describe('the message under the list: every state says what the person can do', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => person(`p${i}`, `Person ${i}`));
  const STATES: Array<[string, Parameters<typeof listMessage>[0], { tone: string; text: string } | null]> = [
    ['before typing', { kind: 'idle' }, { tone: 'muted', text: PICKER_COPY.idle }],
    ['searching', { kind: 'searching', term: 'ma' }, { tone: 'muted', text: PICKER_COPY.searching }],
    ['search failed', { kind: 'error', term: 'ma' }, { tone: 'error', text: PICKER_COPY.error }],
    ['no match', { kind: 'done', term: 'zz', people: [] }, { tone: 'muted', text: PICKER_COPY.none('zz') }],
    ['one match', { kind: 'done', term: 'an', people: many(1) }, null],
    ['three matches', { kind: 'done', term: 'an', people: many(3) }, null],
    ['the cap (8)', { kind: 'done', term: 'a', people: many(8) }, { tone: 'muted', text: PICKER_COPY.capped }],
  ];
  it.each(STATES)('%s', (_n, s, want) => expect(listMessage(s)).toEqual(want));
  it('the no-match line names a next step (spelling or the invite link)', () => {
    expect(PICKER_COPY.none('zz')).toMatch(/Check the spelling, or send them an invite link/);
    expect(PICKER_COPY.idle).toMatch(/Type at least two letters/);
    expect(PICKER_COPY.error).toMatch(/type again/);
  });
});

describe('a result row: pickable, picked, or already on the team (not addable)', () => {
  const ana = person('a', 'Ana');
  const ROWS: Array<[string, PersonResult[], string[], string]> = [
    ['fresh', [], [], 'pick'],
    ['picked as a chip', [ana], [], 'picked'],
    ['added on this visit', [], ['a'], 'member'],
    ['added wins over picked', [ana], ['a'], 'member'],
  ];
  it.each(ROWS)('%s', (_n, picked, added, want) => expect(rowState(ana, picked, new Set(added))).toBe(want));

  it('the accessible name says what a tap does, with the city when there is one', () => {
    expect(rowActionLabel(ana, 'pick')).toBe('Pick Ana, London');
    expect(rowActionLabel({ ...ana, city: null }, 'pick')).toBe('Pick Ana');
    expect(rowActionLabel(ana, 'member')).toBe('Ana, London: already on the team');
    expect(rowActionLabel(ana, 'picked')).toMatch(/picked/);
    expect(personSubline({ ...ana, city: null })).toBe('City not added');
  });

  it.each([['Ana Ruiz', 'AR'], ['marco', 'M'], ['José Ñúñez', 'JÑ'], ['  ', '?'], ['Ana María de la Luz', 'AL']])('initials %j -> %j', (n, want) =>
    expect(personInitials(n)).toBe(want));
});

describe('Done: blocked WITH a reason, by role x chips x reason x connection', () => {
  const CASES: Array<[string, Parameters<typeof addBlockedReason>[0], RegExp | null]> = [
    ['owner, nothing picked (Done only closes)', { access: 'owner', picked: 0, reason: '' }, null],
    ['owner, one picked', { access: 'owner', picked: 1, reason: '' }, null],
    ['owner, offline', { access: 'owner', picked: 1, reason: '', online: false }, /offline/],
    ['admin, nothing picked', { access: 'admin', picked: 0, reason: '' }, null],
    ['admin, picked, no reason', { access: 'admin', picked: 2, reason: '   ' }, /Write a reason first/],
    ['admin, picked, reason', { access: 'admin', picked: 2, reason: 'Asked by the owner by phone' }, null],
    ['admin, reason too long', { access: 'admin', picked: 1, reason: 'x'.repeat(501) }, /under 500/],
  ];
  it.each(CASES)('%s', (_n, input, want) => {
    const r = addBlockedReason(input);
    if (want) expect(r).toMatch(want);
    else expect(r).toBeNull();
  });

  it('the line above Done states the effect before the tap', () => {
    expect(willAddLine([], 'manager')).toBeNull();
    expect(willAddLine([person('a', 'Ana')], 'manager')).toBe('Done adds Ana as a manager. They can help at once.');
    expect(willAddLine([person('a', 'Ana'), person('b', 'Ben')], 'contributor')).toBe('Done adds 2 people as contributors. They can help at once.');
  });
});

describe('the server refusal, in plain words (never the raw error)', () => {
  // Every code organiser_team_add_member_by_profile_v1 and its gate can raise (admin #773).
  const CODES = [
    'authentication_required', 'organiser_id_required', 'not_authorised', 'owner_only', 'organiser_not_found',
    'reason_required', 'reason_too_long', 'reason_invalid', 'use_transfer', 'invalid_member_role',
    'user_not_found', 'unconfirmed_email', 'target_is_owner', 'last_owner', 'user_id_required',
  ];
  it.each(CODES)('%s', (code) => {
    const text = addRefusalCopy({ message: code, code: 'P0001' });
    expect(text).not.toContain(code);
    expect(text).not.toMatch(/email address\. Ask them to sign up/); // the add-by-email line would mislead here
    expect(text.length).toBeGreaterThan(10);
  });
  it.each([
    ['user_not_found', /hidden or gone/],
    ['unconfirmed_email', /not confirmed their email/],
    ['target_is_owner', /already an owner/],
    ['owner_only', /Only an owner/],
  ])('%s says what happened to the person', (code, want) => expect(addRefusalCopy({ message: code })).toMatch(want));
  it.each([
    ['dropped connection', { message: 'TypeError: Failed to fetch' }],
    ['no message', {}],
    ['null', null],
  ])('%s -> the network line', (_n, e) => expect(addRefusalCopy(e)).toBe(PICKER_COPY.network));
  it('an unknown server text is never shown raw', () => {
    const raw = 'duplicate key value violates unique constraint "entity_members_pkey"';
    expect(addRefusalCopy({ message: raw, code: '23505' })).not.toContain('duplicate key');
  });
});

describe('Done adds every chip, one call each; one refusal does not stop the rest', () => {
  it('mixed outcomes, in order, never throws', async () => {
    const calls: string[] = [];
    const out = await addPicked(async (id) => {
      calls.push(id);
      if (id === 'b') throw { message: 'unconfirmed_email', code: 'P0001' };
      if (id === 'c') return { changed: false, member_role: 'manager' };
      return { changed: true, member_role: 'manager', profile_id: id };
    }, [person('a', 'Ana'), person('b', 'Ben'), person('c', 'Cleo')]);
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(out).toEqual([
      { profileId: 'a', name: 'Ana', ok: true, already: false },
      { profileId: 'b', name: 'Ben', ok: false, message: addRefusalCopy({ message: 'unconfirmed_email' }) },
      { profileId: 'c', name: 'Cleo', ok: true, already: true },
    ]);
    expect(addedMessage(out, 'manager')).toBe('Ana is now a manager. Cleo was already a manager.');
  });
  it('nothing picked sends no command', async () => {
    let n = 0;
    expect(await addPicked(async () => { n += 1; }, [])).toEqual([]);
    expect(n).toBe(0);
  });
  it.each([
    [{ changed: true, member_role: 'manager' }, { changed: true, role: 'manager' }],
    [{ changed: false, member_role: 'contributor' }, { changed: false, role: 'contributor' }],
    [null, { changed: true, role: null }],
  ])('parseAddResult(%j)', (raw, want) => expect(parseAddResult(raw)).toEqual(want));
  it('confirmation lines', () => {
    expect(addedMessage([], 'manager')).toBeNull();
    expect(addedMessage([{ profileId: 'a', name: 'Ana', ok: false, message: 'x' }], 'manager')).toBeNull();
    expect(addedMessage([
      { profileId: 'a', name: 'Ana', ok: true, already: false },
      { profileId: 'b', name: 'Ben', ok: true, already: false },
    ], 'contributor')).toBe('2 people are now contributors.');
  });
});

describe('the Team card line, over the team sizes production holds', () => {
  const SIZES: Array<[string, { owner: number; manager: number; contributor: number }, string]> = [
    ['no member (41 organisers; only an admin could see it)', { owner: 0, manager: 0, contributor: 0 }, 'No one is on the team yet. Add a person to share the work.'],
    ['one owner (3 organisers)', { owner: 1, manager: 0, contributor: 0 }, 'On the team: 1 owner.'],
    ['two owners (1 organiser)', { owner: 2, manager: 0, contributor: 0 }, 'On the team: 2 owners.'],
    ['owner, managers and a contributor', { owner: 1, manager: 2, contributor: 1 }, 'On the team: 1 owner, 2 managers, 1 contributor.'],
  ];
  it.each(SIZES)('%s', (_n, c, want) => expect(teamCountLine(c)).toBe(want));
});

describe('the invite fallback', () => {
  it('is a sign-up link with the organiser named, and no trailing slash doubled', () => {
    expect(inviteShare('Ritmo Latino', 'https://www.bachatacalendar.com/')).toEqual({
      title: 'Join Bachata Calendar',
      text: 'Join Bachata Calendar and make your dancer profile, so I can add you to the Ritmo Latino team.',
      url: 'https://www.bachatacalendar.com/auth',
    });
  });
});
