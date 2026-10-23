// ER-FIX2-S4 (F6/F7): the role x control table over the CURRENT truth -- owner decision 4
// (everyone on an event has full control) and the shapes from the prod survey
// (747 series: 571 with no linked page, 170 with one, 6 with two).
import { describe, expect, it } from 'vitest';
import {
  BLOCK_TEXT, canOffer, controlFor, controlState, emptyText, LEAVE_CONFIRM, LEAVE_ROW_LABEL, NO_ORGANISERS, NOT_ON_EVENT_REASON, OWNER_CANNOT_LEAVE,
  parseInvitations, parseOrganisers, publicLine, rowAction, searchMore, SEARCH_LIMIT, viewerRole, viewerRoleOnEvent, withInvited,
  type Control, type OrganiserRow, type ViewerRole,
} from '../organiserModel';
import * as M from '../organiserModel';

const owner: OrganiserRow = { pageId: 'o', name: 'Bachata Nights', role: 'owner', status: 'accepted', inviteId: null };
const co: OrganiserRow = { pageId: 'c', name: 'Salsa Crew', role: 'co', status: 'accepted', inviteId: null };
const co2: OrganiserRow = { pageId: 'c2', name: 'Kizomba Club', role: 'co', status: 'accepted', inviteId: null };
const invited: OrganiserRow = { pageId: 'i', name: 'Zouk Club', role: 'co', status: 'invited', inviteId: 'inv1' };
const ROWS = [owner, co, invited];

describe('parse', () => {
  it('reads series_organisers_v1, owner first, one row per page (accepted beats invited)', () => {
    const rows = parseOrganisers({ organisers: [
      { page_id: 'c', name: 'Salsa Crew', role: 'co', status: 'invited', invite_id: 'x' },
      { page_id: 'o', name: 'Bachata Nights', role: 'owner', status: 'accepted' },
      { page_id: 'c', name: 'Salsa Crew', role: 'co', status: 'accepted' },
      { name: 'no id' },
    ] });
    expect(rows.map((r) => [r.pageId, r.status])).toEqual([['o', 'accepted'], ['c', 'accepted']]);
  });
  it.each([null, undefined, {}, { organisers: 'x' }, { organisers: [] }])('bad or empty payload %j -> empty', (d) => expect(parseOrganisers(d)).toEqual([]));
  it('reads my_organiser_invites_v1 once per invite', () => {
    const r = parseInvitations({ invites: [
      { invite_id: 'a', series_id: 's', series_name: 'Friday', invited_page_id: 'p', invited_page_name: 'Mine', invited_by_name: 'Ana' },
      { invite_id: 'a', series_id: 's' }, { series_id: 'no invite id' },
    ] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ inviteId: 'a', seriesName: 'Friday', invitedByName: 'Ana' });
    expect(parseInvitations(null)).toEqual([]);
  });
});

describe('viewer role from the list (owner / co / non-member)', () => {
  it.each<[string, string[], ViewerRole]>([
    ['owner page', ['o'], 'owner'], ['co page', ['c'], 'co'], ['both: owner wins', ['c', 'o'], 'owner'],
    ['only an invited page: no rights', ['i'], 'none'], ['a stranger', ['z'], 'none'], ['no pages', [], 'none'],
  ])('%s -> %s', (_n, mine, want) => expect(viewerRole(ROWS, mine)).toBe(want));
});

describe('F5: viewer role when the list is empty (571 of 747 prod series have no linked page)', () => {
  it.each<[string, OrganiserRow[], string[], { organiserIds: string[]; homeRole: 'owner' | 'manager' | null }, ViewerRole]>([
    ['no rows, the event is under my page on Home', [], ['p'], { organiserIds: [], homeRole: 'owner' }, 'co'],
    ['no rows, Home says manager', [], ['p'], { organiserIds: [], homeRole: 'manager' }, 'co'],
    ['no rows, my page is the event read owner (index 0)', [], ['p'], { organiserIds: ['p'], homeRole: null }, 'owner'],
    ['no rows, my page is linked second', [], ['p'], { organiserIds: ['x', 'p'], homeRole: null }, 'co'],
    ['no rows and nothing ties me to it', [], ['p'], { organiserIds: [], homeRole: null }, 'none'],
    ['only an invited row: still decided by the event read', [invited], ['p'], { organiserIds: [], homeRole: 'owner' }, 'co'],
    ['an accepted list is the truth: a stranger stays none even if Home lists it', ROWS, ['z'], { organiserIds: [], homeRole: 'owner' }, 'none'],
    ['an accepted list is the truth: my co row', ROWS, ['c'], { organiserIds: [], homeRole: null }, 'co'],
  ])('%s -> %s', (_n, rows, mine, ev, want) => expect(viewerRoleOnEvent(rows, mine, ev)).toBe(want));
});

const CONTROLS: Control[] = ['invite', 'cancelInvite', 'removeOrganiser', 'leave', 'end', 'stopRepeating', 'deleteDraft', 'cancelOneOff'];
// role x control -> on?  (owner / co / none). Decision 4: full control; only Leave differs (the owner page cannot leave; the server refuses it).
const ON: Record<Control, [boolean, boolean, boolean]> = {
  invite: [true, true, false], cancelInvite: [true, true, false], removeOrganiser: [true, true, false], leave: [false, true, false],
  end: [true, true, false], stopRepeating: [true, true, false], deleteDraft: [true, true, false], cancelOneOff: [true, true, false],
};

describe('F6: controls, role x control table (full control)', () => {
  it.each(CONTROLS.flatMap((c) => (['owner', 'co', 'none'] as ViewerRole[]).map((r, i) => [c, r, ON[c][i]] as const)))(
    '%s as %s -> on=%s, and an off control always says why', (control, role, on) => {
      const s = controlState(role, control);
      expect(s.on).toBe(on);
      expect(s.reason === null).toBe(on);
    });
  it('no reason anywhere says "only the owner"', () => {
    for (const c of CONTROLS) for (const r of ['owner', 'co', 'none'] as ViewerRole[]) expect(controlState(r, c).reason ?? '').not.toMatch(/only the owner/i);
    expect(controlState('owner', 'leave').reason).toBe(OWNER_CANNOT_LEAVE);
  });
  it('the owner-only exports are gone', () => {
    expect('OWNER_ONLY' in M).toBe(false);
    expect('OWNER_ONLY_REASON' in M).toBe(false);
    expect('REMOVE_OWNER_ONLY_REASON' in M).toBe(false);
    expect('removeNote' in M).toBe(false);
  });
  it('a non-member gets the not-on-event reason everywhere', () => {
    for (const c of CONTROLS) expect(controlState('none', c).reason).toBe(NOT_ON_EVENT_REASON);
  });
  it.each(['ended', 'archived'])('Invite is off on a %s event for everyone, with the lock text; other controls keep their rule', (life) => {
    expect(controlFor('owner', life, 'invite').reason).toMatch(/can't be changed/);
    expect(controlFor('co', life, 'invite').reason).toMatch(/can't be changed/);
    expect(controlFor('co', life, 'end').on).toBe(true);
  });
  it.each(['live', 'draft', 'paused'])('Invite is on for owner and co on a %s event, off for a non-member', (life) => {
    expect(controlFor('owner', life, 'invite').on).toBe(true);
    expect(controlFor('co', life, 'invite').on).toBe(true);
    expect(controlFor('none', life, 'invite').reason).toBe(NOT_ON_EVENT_REASON);
  });
});

describe('F6: rows, Remove / Cancel / Leave (full control)', () => {
  it.each<[string, OrganiserRow, ViewerRole, string[], string | null]>([
    ['owner removes a co', co, 'owner', ['o'], 'remove'],
    ['a co removes ANOTHER co', co2, 'co', ['c'], 'remove'],
    ['nobody removes the owner (owner viewing)', owner, 'owner', ['o'], null],
    ['nobody removes the owner (co viewing)', owner, 'co', ['c'], null],
    ['co leaves on their own row', co, 'co', ['c'], 'leave'],
    ['an invited row can be cancelled by an owner', invited, 'owner', ['o'], 'cancel'],
    ['an invited row can be cancelled by a co', invited, 'co', ['c'], 'cancel'],
    ['an invited row without an invite id offers nothing', { ...invited, inviteId: null }, 'owner', ['o'], null],
    ['a non-member gets nothing', co, 'none', ['z'], null],
  ])('%s', (_n, row, role, mine, want) => expect(rowAction(row, role, mine)).toBe(want));
});

describe('no duplicate organiser or invite', () => {
  it('canOffer is false for a linked or an invited page', () => {
    expect(['o', 'c', 'i', 'new'].map((id) => canOffer(ROWS, id))).toEqual([false, false, false, true]);
  });
  it('withInvited adds a new page once and never twice', () => {
    const once = withInvited(ROWS, { id: 'new', name: 'New' }, 'inv2');
    expect(once).toHaveLength(4);
    expect(withInvited(once, { id: 'new', name: 'New' }, 'inv3')).toHaveLength(4);
    expect(withInvited(ROWS, { id: 'c', name: 'Salsa Crew' }, 'x')).toBe(ROWS);
  });
});

describe('copy (F6, F10, F11, F12, F5 empty state)', () => {
  it('block text says full control, never "only the owner"', () => {
    expect(BLOCK_TEXT).not.toMatch(/only the owner/i);
    expect(BLOCK_TEXT).toMatch(/every organiser/i);
  });
  it('leave confirm: any organiser can invite you again', () => expect(LEAVE_CONFIRM).toMatch(/Any organiser on the event can invite you again/));
  it('the row button is the short "Leave"', () => expect(LEAVE_ROW_LABEL).toBe('Leave'));
  it('the empty list says what to do when Invite is on, and only the fact when it is off', () => {
    expect(emptyText(true)).toMatch(/Invite an organiser/);
    expect(emptyText(true).startsWith(NO_ORGANISERS)).toBe(true);
    expect(emptyText(false)).toBe(NO_ORGANISERS);
  });
  it.each([[0, false], [5, false], [SEARCH_LIMIT - 1, false], [SEARCH_LIMIT, true]])('search with %i results -> more hint %s', (n, more) => {
    expect(SEARCH_LIMIT).toBe(20);
    expect(searchMore(n) !== null).toBe(more);
  });
  it('public line shows accepted pages only, owner first', () => {
    expect(publicLine(ROWS)).toBe('By Bachata Nights, Salsa Crew');
    expect(publicLine([invited])).toBe('');
  });
});
