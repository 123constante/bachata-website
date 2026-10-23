/**
 * Edit in place: the ONE save, the card, and the stored draft.
 *
 * THE TRAP: organiser_profile_update_p5_v1 replaces the WHOLE socials object.
 * A naive partial patch ({ socials: { facebook } }) would wipe Instagram and
 * Website out of socials. These tests run over the prod shapes (survey
 * 2026-10-11) and the shapes the brief named, and were run RED against a naive
 * partial-patch buildSavePatch first (see the PR body).
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';
import {
  ADDED_MESSAGE,
  SAVE_COPY,
  buildSavePatch,
  cardModel,
  describeSaveError,
  draftMatchesStored,
  draftStorageKey,
  fieldInPatch,
  overlayFor,
  prunedDrafts,
  readStoredDraft,
  restoredMessage,
  saveDrafts,
  savedMessage,
  unsavedBarText,
  writeStoredDraft,
  type Drafts,
} from '../draftModel';
import { CITY_COPY, FIELD_KEYS, FIELD_LABEL, NAME_COPY, PROMPTED_FIELDS, type FieldKey } from '../fieldRules';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const CITY = '11111111-1111-4111-8111-111111111111';
const OTHER_CITY = 'c2000000-0000-4000-8000-000000000002';
const row = (over: Partial<ProfileEntity> = {}): ProfileEntity => ({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Ritmo Latino',
  avatar_url: 'https://cdn.example/ritmo.jpg',
  bio: null,
  socials: { facebook: 'https://www.facebook.com/ritmolatino' },
  city_id: CITY,
  instagram: 'https://www.instagram.com/ritmolatino/',
  website: 'https://ritmo.co.uk',
  organisation_category: 'Dance School',
  founded_year: null,
  cities: { name: 'London', slug: 'london-gb' },
  ...over,
} as ProfileEntity);

/** The owner's private contact (get_organiser_contact_settings_v1), laid on the row for the save. */
const withContact = (over: Partial<ProfileEntity> = {}) => ({
  ...row(over), contact: { phone: '0113 496 0000', email: 'hello@ritmo.example', showPhone: true, showEmail: false },
});

/** Prod shapes (counts in the PR body) plus the brief's named ones. */
const SHAPES: Array<[string, ProfileEntity]> = [
  ['typical: ig link in column, socials {facebook}, website', row()],
  ['socials {} (20 rows), ig handle in column, no website', row({ socials: {}, instagram: '@ritmo', website: null })],
  ['no links at all (3 rows), no photo', row({ socials: {}, instagram: null, website: null, avatar_url: null })],
  ['website stored without a scheme (5 rows)', row({ website: 'ritmo.co.uk' })],
  ['ig as a bare instagram.com link (1 row)', row({ instagram: 'instagram.com/ritmo' })],
  ['facebook profile.php link (1 row)', row({ socials: { facebook: 'https://www.facebook.com/profile.php?id=100' } })],
  ['brief: ig in the column AND in socials', row({ socials: { instagram: 'https://www.instagram.com/ritmolatino/', facebook: 'https://facebook.com/r' } })],
  ['brief: leading space in a URL (server btrims)', row({ website: ' https://ritmo.co.uk', socials: { facebook: ' https://facebook.com/r' } })],
  ['brief: only a socials value (no columns)', row({ instagram: null, website: null, socials: { instagram: '@ritmo', website: 'https://ritmo.co.uk' } })],
  ['brief: very long About', row({ bio: 'x'.repeat(3990) })],
  ['socials null', row({ socials: null })],
];

const ig = (p: Record<string, unknown>) => ({ col: p.instagram, soc: (p.socials as Record<string, unknown>).instagram });
const web = (p: Record<string, unknown>) => ({ col: p.website, soc: (p.socials as Record<string, unknown>).website });

describe('no partial socials: the save is the stored form plus the drafts', () => {
  it.each(SHAPES)('%s: saving ONLY Facebook keeps Instagram and Website in their columns AND in socials', (_n, e) => {
    const base = buildSavePatch(e, {});
    const p = buildSavePatch(e, { facebook: 'https://facebook.com/newpage' });
    expect((p.socials as Record<string, unknown>).facebook).toBe('https://facebook.com/newpage');
    expect(Object.keys(p.socials as object).sort()).toEqual(['facebook', 'instagram', 'website']);
    expect(ig(p)).toEqual(ig(base));
    expect(web(p)).toEqual(web(base));
    // And they are the STORED values, not blanks (when one is stored).
    const storedIg = (e.instagram || (e.socials as Record<string, string> | null)?.instagram || '').trim();
    if (storedIg) expect(p.instagram).not.toBeNull();
    const storedWeb = (e.website || (e.socials as Record<string, string> | null)?.website || '').trim();
    if (storedWeb) expect((p.socials as Record<string, unknown>).website).not.toBeNull();
  });

  it.each(SHAPES)('%s: saving ONLY Year sends every other field unchanged', (_n, e) => {
    const base = buildSavePatch(e, {});
    const p = buildSavePatch(e, { founded_year: '2019' });
    expect(p.founded_year).toBe(2019);
    expect({ ...p, founded_year: null }).toEqual({ ...base, founded_year: null });
  });

  it.each(SHAPES)('%s: never sends contact_email, contact_phone or show_contact_publicly', (_n, e) => {
    for (const drafts of [{}, { bio: 'Hi' }, { instagram: '@x', website: 'x.com', facebook: 'x' }] as Drafts[]) {
      const p = buildSavePatch(e, drafts);
      expect(p).not.toHaveProperty('contact_email');
      expect(p).not.toHaveProperty('contact_phone');
      expect(p).not.toHaveProperty('show_contact_publicly');
      expect(p.city_id).toBe(CITY);
      expect(p.name).toBe('Ritmo Latino');
    }
  });

  it.each(SHAPES)('%s: saving ONLY Name changes the name and nothing else', (_n, e) => {
    const base = buildSavePatch(e, {});
    const p = buildSavePatch(e, { name: '  Ritmo Nuevo ' });
    expect(p.name).toBe('Ritmo Nuevo');
    expect({ ...p, name: null }).toEqual({ ...base, name: null });
  });

  it.each(SHAPES)('%s: saving ONLY City changes city_id and nothing else (socials kept whole)', (_n, e) => {
    const base = buildSavePatch(e, {});
    const p = buildSavePatch(e, { city: OTHER_CITY });
    expect(p.city_id).toBe(OTHER_CITY);
    expect({ ...p, city_id: null }).toEqual({ ...base, city_id: null });
    expect(p).not.toHaveProperty('city');
  });

  it.each(SHAPES)('%s: Name + City + a link in one draft: one patch, every field where it belongs', (_n, e) => {
    const p = buildSavePatch(e, { name: 'Ritmo Nuevo', city: OTHER_CITY, facebook: 'https://facebook.com/newpage' });
    expect(p.name).toBe('Ritmo Nuevo');
    expect(p.city_id).toBe(OTHER_CITY);
    expect((p.socials as Record<string, unknown>).facebook).toBe('https://facebook.com/newpage');
    for (const k of ['contact_email', 'contact_phone', 'show_contact_publicly', 'city']) expect(p).not.toHaveProperty(k);
  });

  it('a stored value with a leading space goes out trimmed (the server btrims it too)', () => {
    const p = buildSavePatch(row({ website: ' https://ritmo.co.uk' }), { founded_year: '2019' });
    expect(p.website).toBe('https://ritmo.co.uk');
  });

  it('a very long About is kept whole when another field is saved', () => {
    const e = row({ bio: 'x'.repeat(3990) });
    expect(buildSavePatch(e, { founded_year: '2019' }).bio).toBe('x'.repeat(3990));
  });
});

describe('drafts that change nothing are not drafts', () => {
  it.each([
    ['instagram', 'https://www.instagram.com/ritmolatino/'],
    ['website', 'https://ritmo.co.uk'],
    ['website', ' ritmo.co.uk '.trim().replace(/^/, 'https://')],
    ['facebook', 'https://www.facebook.com/ritmolatino'],
    ['organisation_category', 'Dance School'],
    ['founded_year', ''],
    ['bio', '   '],
    ['name', 'Ritmo Latino'],
    ['name', '  Ritmo Latino '],
    ['city', CITY],
  ] as Array<[FieldKey, string]>)('%s %j matches what is stored', (field, value) => {
    expect(draftMatchesStored(row(), field, value)).toBe(true);
    expect(prunedDrafts(row(), { [field]: value })).toEqual({});
  });
  it('a real change survives the prune', () => {
    expect(prunedDrafts(row(), { founded_year: '2019', bio: 'Hi' })).toEqual({ founded_year: '2019', bio: 'Hi' });
    expect(prunedDrafts(row(), { name: 'Ritmo Nuevo', city: OTHER_CITY })).toEqual({ name: 'Ritmo Nuevo', city: OTHER_CITY });
  });
  it('every editable field is covered by the prune (none silently dropped)', () => {
    const changed: Record<FieldKey, string> = {
      name: 'Ritmo Nuevo', city: OTHER_CITY, avatar_url: 'https://cdn.example/new.jpg', founded_year: '2019',
      instagram: '@new', bio: 'Hi', website: 'https://new.example', facebook: 'https://facebook.com/new', organisation_category: 'Promoter',
      contact_phone: '07700 900456', show_phone_publicly: 'false', show_email_publicly: 'true',
    };
    expect(Object.keys(changed).sort()).toEqual([...FIELD_KEYS].sort());
    expect(prunedDrafts(withContact(), changed)).toEqual(changed);
  });
  it('every editable field equal to the stored value is pruned (contact keys included)', () => {
    const same: Record<FieldKey, string> = {
      name: 'Ritmo Latino', city: CITY, avatar_url: 'https://cdn.example/ritmo.jpg', founded_year: '',
      instagram: 'https://www.instagram.com/ritmolatino/', bio: '', website: 'https://ritmo.co.uk', facebook: 'https://www.facebook.com/ritmolatino', organisation_category: 'Dance School',
      contact_phone: ' 0113 496 0000 ', show_phone_publicly: 'true', show_email_publicly: 'false',
    };
    expect(Object.keys(same).sort()).toEqual([...FIELD_KEYS].sort());
    expect(prunedDrafts(withContact(), same)).toEqual({});
  });
  it.each([...FIELD_KEYS])('%s: a change goes out in the ONE patch, in its own key', (field) => {
    const value: Record<FieldKey, string> = {
      name: 'Ritmo Nuevo', city: OTHER_CITY, avatar_url: 'https://cdn.example/new.jpg', founded_year: '2019',
      instagram: '@new', bio: 'Hi', website: 'https://new.example', facebook: 'https://facebook.com/new', organisation_category: 'Promoter',
      contact_phone: '07700 900456', show_phone_publicly: 'false', show_email_publicly: 'true',
    };
    const p = buildSavePatch(withContact(), { [field]: value[field] });
    expect(fieldInPatch(p, field)).not.toEqual(fieldInPatch(buildSavePatch(withContact(), {}), field));
    expect(p).not.toHaveProperty('show_contact_publicly');
    expect(p).not.toHaveProperty('contact_email');
  });
});

describe('overlayFor (drafted values shown in place)', () => {
  it('is empty with no draft', () => expect(overlayFor(row(), {})).toEqual({}));
  it('shows each drafted value as it will be saved, in the row\u2019s own shape', () => {
    const o = overlayFor(row(), { instagram: '@new', facebook: 'https://facebook.com/newpage', founded_year: '2019', avatar_url: '' });
    expect(o.instagram).toBe('@new');
    expect(o.socials).toMatchObject({ instagram: '@new', facebook: 'https://facebook.com/newpage' });
    expect(o.founded_year).toBe(2019);
    expect(o.avatar_url).toBeNull();
    expect(o).not.toHaveProperty('website');
  });
  it('shows a drafted Name trimmed, and a drafted City by its picked name', () => {
    const o = overlayFor(row(), { name: ' Ritmo Nuevo ', city: OTHER_CITY }, { [OTHER_CITY]: 'Manchester' });
    expect(o.name).toBe('Ritmo Nuevo');
    expect(o.city_id).toBe(OTHER_CITY);
    expect(o.cities).toEqual({ name: 'Manchester', slug: null });
  });
  it('a drafted City whose name is not known yet shows no stale city name', () => {
    const o = overlayFor(row(), { city: OTHER_CITY });
    expect(o.city_id).toBe(OTHER_CITY);
    expect(o.cities).toBeNull();
  });
  it('a Name or City draft leaves the other fields out of the overlay', () => {
    expect(Object.keys(overlayFor(row(), { name: 'X' }))).toEqual(['name']);
    expect(Object.keys(overlayFor(row(), { city: OTHER_CITY }, { [OTHER_CITY]: 'Leeds' })).sort()).toEqual(['cities', 'city_id']);
  });
});

// ---- the card: every prompted-field combination ---------------------------------------------

const KEYS = PROMPTED_FIELDS.map((p) => p.key);
const SAVED_VALUE: Record<string, Partial<ProfileEntity>> = {
  avatar_url: { avatar_url: 'https://cdn.example/a.jpg' },
  founded_year: { founded_year: 2015 },
  instagram: { instagram: '@ritmo' },
};
const EMPTY: Partial<ProfileEntity> = { avatar_url: null, founded_year: null, instagram: null, socials: {} };
const DRAFT_VALUE: Record<string, string> = { avatar_url: 'https://cdn.example/new.webp', founded_year: '2019', instagram: '@new' };

const subsets = <T,>(xs: T[]): T[][] => xs.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);

const COMBOS = subsets(KEYS).flatMap((saved) => {
  const missing = KEYS.filter((k) => !saved.includes(k));
  return subsets(missing).map((drafted) => ({ saved, drafted, name: `saved [${saved.join(',')}] drafted [${drafted.join(',')}]` }));
});

describe('cardModel over every prompted combination', () => {
  it('covers all 27 combinations (each field: saved, drafted, or missing)', () => expect(COMBOS).toHaveLength(27));

  it.each(COMBOS)('$name', ({ saved, drafted }) => {
    const e = row({ ...EMPTY, ...Object.assign({}, ...saved.map((k) => SAVED_VALUE[k])) });
    const drafts: Drafts = Object.fromEntries(drafted.map((k) => [k, DRAFT_VALUE[k]]));
    const m = cardModel(e, drafts);
    const missing = KEYS.filter((k) => !saved.includes(k));
    // Disappears for good only once all three are SAVED (drafted does not count).
    expect(m.show).toBe(missing.length > 0);
    // In ORDER, only the missing ones; drafted ones carry the tick + unsaved tag.
    expect(m.rows.map((r) => r.key)).toEqual(missing);
    expect(m.rows.map((r) => r.drafted)).toEqual(missing.map((k) => drafted.includes(k)));
    expect(m.rows.map((r) => r.label)).toEqual(missing.map((k) => FIELD_LABEL[k]));
    expect(m.done).toBe(saved.length + drafted.length);
    expect(m.total).toBe(3);
    // Only three prompted fields exist: never a "show more".
    expect(m.more).toEqual([]);
  });

  it('returns when a saved field is later emptied', () => {
    expect(cardModel(row({ founded_year: 2015, instagram: '@r' }), {}).show).toBe(false);
    expect(cardModel(row({ founded_year: null, instagram: '@r' }), {}).show).toBe(true);
  });

  it('an emptied draft of a missing field is not a tick', () => {
    expect(cardModel(row({ ...EMPTY }), { founded_year: '' }).rows[1].drafted).toBe(false);
  });

  it('a "show more" only appears past three rows', () => {
    const four = [...PROMPTED_FIELDS, { key: 'website' as const, importance: 'Recommended' as const, reason: 'r' }];
    const m = cardModel(row({ ...EMPTY, website: null }), {}, 3, four);
    expect(m.rows).toHaveLength(3);
    expect(m.more.map((r) => r.key)).toEqual(['website']);
  });
});

// ---- storage ---------------------------------------------------------------------------------

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('denied'); } };

describe('the stored draft (keyed by organiser id)', () => {
  it('round-trips and is per organiser', () => {
    const s = memory();
    writeStoredDraft('a', { founded_year: '2019', bio: 'Hi' }, s);
    expect(readStoredDraft('a', s)).toEqual({ founded_year: '2019', bio: 'Hi' });
    expect(readStoredDraft('b', s)).toEqual({});
    writeStoredDraft('c', { name: 'Ritmo Nuevo', city: OTHER_CITY }, s);
    expect(readStoredDraft('c', s)).toEqual({ name: 'Ritmo Nuevo', city: OTHER_CITY });
    expect([...s.m.keys()]).toEqual([draftStorageKey('a'), draftStorageKey('c')]);
  });
  it('an empty draft removes the key', () => {
    const s = memory();
    writeStoredDraft('a', { bio: 'Hi' }, s);
    writeStoredDraft('a', {}, s);
    expect(s.m.size).toBe(0);
  });
  it('ignores junk, unknown fields and non-strings', () => {
    const s = memory();
    s.setItem(draftStorageKey('a'), 'not json');
    expect(readStoredDraft('a', s)).toEqual({});
    s.setItem(draftStorageKey('a'), JSON.stringify({ v: 1, fields: { bio: 'ok', contact_email: 'x@y', founded_year: 2019 } }));
    expect(readStoredDraft('a', s)).toEqual({ bio: 'ok' });
    s.setItem(draftStorageKey('a'), JSON.stringify({ v: 2, fields: { bio: 'ok' } }));
    expect(readStoredDraft('a', s)).toEqual({});
  });
  it('never throws when storage does', () => {
    expect(readStoredDraft('a', throwing)).toEqual({});
    expect(() => writeStoredDraft('a', { bio: 'x' }, throwing)).not.toThrow();
    expect(readStoredDraft('a', null)).toEqual({});
  });
});

// ---- the save --------------------------------------------------------------------------------

const rpcOk = (profile: Record<string, unknown>) => vi.fn(async () => ({ data: { changed_keys: [], profile }, error: null }));
const profileFrom = (e: ProfileEntity, drafts: Drafts) => {
  const p = buildSavePatch(e, drafts);
  return { avatar_url: p.avatar_url, bio: p.bio, instagram: p.instagram, website: p.website, organisation_category: p.organisation_category, founded_year: p.founded_year, socials: p.socials };
};

describe('saveDrafts', () => {
  it('ONE call for every drafted field, through organiser_profile_update_p5_v1', async () => {
    const e = row();
    const drafts = { founded_year: '2019', instagram: '@new', bio: 'Hello' };
    const rpc = rpcOk(profileFrom(e, drafts));
    const out = await saveDrafts({ rpc } as never, e.id, e, drafts);
    expect(out).toMatchObject({ kind: 'saved', unmatched: [] });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('organiser_profile_update_p5_v1', { p_organiser_id: e.id, p_patch: buildSavePatch(e, drafts) });
  });

  it('an untouched record sends no command', async () => {
    const rpc = vi.fn();
    expect(await saveDrafts({ rpc } as never, 'x', row(), {})).toEqual({ kind: 'nothing' });
    expect(await saveDrafts({ rpc } as never, 'x', row(), { organisation_category: 'Dance School' })).toEqual({ kind: 'nothing' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a draft failing our own check never reaches the server', async () => {
    const rpc = vi.fn();
    expect(await saveDrafts({ rpc } as never, 'x', row(), { founded_year: '1800' })).toEqual({ kind: 'refused', field: 'founded_year', message: SAVE_COPY.field('founded_year') });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_socials: instagram', 'instagram'],
    ['invalid_socials: website', 'website'],
    ['invalid_socials: facebook', 'facebook'],
    ['invalid_instagram', 'instagram'],
    ['invalid_website', 'website'],
    ['invalid_avatar_url', 'avatar_url'],
    ['founded_year_out_of_range: a whole year from 1900 to this year', 'founded_year'],
    ['bio_too_long', 'bio'],
    ['bio_invalid', 'bio'],
    ['organisation_category_too_long', 'organisation_category'],
    ['name_too_long', 'name'],
    ['name_invalid', 'name'],
    ['name_required', 'name'],
    ['city_required', 'city'],
    ['contact_phone_too_long', 'contact_phone'],
    ['contact_phone_invalid', 'contact_phone'],
    ['invalid_value_type: show_phone_publicly must be true or false', 'show_phone_publicly'],
    ['invalid_value_type: show_email_publicly must be true or false', 'show_email_publicly'],
  ] as Array<[string, FieldKey]>)('server refuses %j -> names %s in plain words', async (message, field) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    const out = await saveDrafts({ rpc } as never, 'x', row(), { bio: 'Hi' });
    expect(out).toEqual({ kind: 'refused', field, message: SAVE_COPY.field(field) });
    expect((out as { message: string }).message).toContain(FIELD_LABEL[field]);
    expect((out as { message: string }).message).toContain('Your changes are kept');
  });

  it.each([
    ['permission_denied: editing an organiser profile needs its owner', SAVE_COPY.permission],
    ['authentication_required', SAVE_COPY.signedOut],
    ['unknown_patch_key: city', SAVE_COPY.generic],
  ])('server refuses %j (no field)', async (message, copy) => {
    const rpc = vi.fn(async () => ({ data: null, error: { message } }));
    expect(await saveDrafts({ rpc } as never, 'x', row(), { bio: 'Hi' })).toEqual({ kind: 'refused', field: null, message: copy });
  });

  it('a taken name is refused ON the Name field, with copy that says what to do', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'organiser_name_taken' } }));
    const out = await saveDrafts({ rpc } as never, 'x', row(), { name: 'Salsa Club' });
    expect(out).toEqual({ kind: 'refused', field: 'name', message: SAVE_COPY.nameTaken, fieldError: NAME_COPY.taken });
    expect(SAVE_COPY.nameTaken).toContain('Your changes are kept');
  });

  it('a city the server cannot find is refused ON the City field', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'city_not_found' } }));
    const out = await saveDrafts({ rpc } as never, 'x', row(), { city: OTHER_CITY });
    expect(out).toEqual({ kind: 'refused', field: 'city', message: SAVE_COPY.field('city'), fieldError: CITY_COPY.notFound });
  });

  it('Name and City go out in the ONE call (name, city_id)', async () => {
    const e = row();
    const drafts = { name: 'Ritmo Nuevo', city: OTHER_CITY };
    const rpc = rpcOk({ ...profileFrom(e, drafts), name: 'Ritmo Nuevo', city_id: OTHER_CITY });
    expect(await saveDrafts({ rpc } as never, e.id, e, drafts)).toMatchObject({ kind: 'saved', unmatched: [], stored: { name: 'Ritmo Nuevo', city: OTHER_CITY } });
    expect(rpc).toHaveBeenCalledTimes(1);
    const args = (rpc.mock.calls[0] as unknown as [string, { p_patch: Record<string, unknown> }])[1];
    expect(args.p_patch.name).toBe('Ritmo Nuevo');
    expect(args.p_patch.city_id).toBe(OTHER_CITY);
  });

  it('a contact change goes out in the ONE call with ONLY the changed keys (never the legacy flag)', async () => {
    const e = withContact();
    // The sheet's PhoneInput hands over E.164 (invite journey W2: one phone rule).
    const drafts = { show_email_publicly: 'true', contact_phone: '+447700900456', bio: 'Hi' };
    // The RPC's profile carries contact_phone but not the flags: a flag is never "came back different".
    const rpc = rpcOk({ ...profileFrom(e, drafts), contact_phone: '+447700900456' });
    expect(await saveDrafts({ rpc } as never, e.id, e, drafts)).toMatchObject({ kind: 'saved', unmatched: [] });
    expect(rpc).toHaveBeenCalledTimes(1);
    const args = (rpc.mock.calls[0] as unknown as [string, { p_patch: Record<string, unknown> }])[1];
    expect(args.p_patch).toMatchObject({ show_email_publicly: true, contact_phone: '+447700900456', bio: 'Hi' });
    expect(args.p_patch).not.toHaveProperty('show_phone_publicly');
    expect(args.p_patch).not.toHaveProperty('show_contact_publicly');
    expect(args.p_patch).not.toHaveProperty('contact_email');
  });

  it('a phone our own check refuses never reaches the server', async () => {
    const rpc = vi.fn();
    expect(await saveDrafts({ rpc } as never, 'x', withContact(), { contact_phone: '12' })).toEqual({ kind: 'refused', field: 'contact_phone', message: SAVE_COPY.field('contact_phone') });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a contact draft while the contact details are not loaded is never sent and says so', async () => {
    const rpc = vi.fn();
    const out = await saveDrafts({ rpc } as never, 'x', { ...row(), contact: null }, { show_phone_publicly: 'false' });
    expect(out).toEqual({ kind: 'refused', field: 'show_phone_publicly', message: SAVE_COPY.contactNotLoaded });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a Name or City our own check refuses never reaches the server', async () => {
    const rpc = vi.fn();
    expect(await saveDrafts({ rpc } as never, 'x', row(), { name: '   ' })).toMatchObject({ kind: 'refused', field: 'name' });
    expect(await saveDrafts({ rpc } as never, 'x', row(), { name: 'R'.repeat(81) })).toMatchObject({ kind: 'refused', field: 'name' });
    expect(await saveDrafts({ rpc } as never, 'x', row(), { city: 'London' })).toMatchObject({ kind: 'refused', field: 'city' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a network error (returned or thrown) says so and keeps the draft', async () => {
    const returned = vi.fn(async () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } }));
    const thrown = vi.fn(async () => { throw new TypeError('Load failed'); });
    expect(await saveDrafts({ rpc: returned } as never, 'x', row(), { bio: 'Hi' })).toEqual({ kind: 'network', message: SAVE_COPY.network });
    expect(await saveDrafts({ rpc: thrown } as never, 'x', row(), { bio: 'Hi' })).toEqual({ kind: 'network', message: SAVE_COPY.network });
  });

  it('reports a field whose stored value came back different from what was sent', async () => {
    const e = row();
    const drafts = { founded_year: '2019', bio: 'Hello' };
    const rpc = rpcOk({ ...profileFrom(e, drafts), bio: 'Something else' });
    expect(await saveDrafts({ rpc } as never, e.id, e, drafts)).toMatchObject({ kind: 'saved', unmatched: ['bio'] });
  });

  it('describeSaveError: an unknown shape is the generic message', () => {
    expect(describeSaveError({ message: 'weird_code' })).toEqual({ kind: 'refused', field: null, message: SAVE_COPY.generic });
    expect(describeSaveError(null)).toEqual({ kind: 'network', message: SAVE_COPY.network });
  });

  it('fieldInPatch reads facebook out of socials', () => {
    expect(fieldInPatch(buildSavePatch(row(), {}), 'facebook')).toBe('https://www.facebook.com/ritmolatino');
  });
});

describe('copy', () => {
  it('says exactly what the brief asked for', () => {
    expect(ADDED_MESSAGE).toBe('Added to your changes. Not saved yet. Tap Save to put it on your page.');
    expect(restoredMessage(2)).toBe('You have an unsaved draft from earlier. 2 changes are not on your page. Save or discard them.');
    expect(restoredMessage(1)).toBe('You have an unsaved draft from earlier. 1 change is not on your page. Save or discard them.');
    expect(unsavedBarText(1)).toBe('1 change not saved');
    expect(unsavedBarText(3)).toBe('3 changes not saved');
    // Honest about the Cloudflare HTML cache (no purge for organiser pages).
    expect(savedMessage('14:05')).toBe('Saved at 14:05. Visitors may take a few minutes to see it.');
    for (const m of [ADDED_MESSAGE, savedMessage('1'), restoredMessage(1)]) expect(m).not.toMatch(/review/i);
  });
});
