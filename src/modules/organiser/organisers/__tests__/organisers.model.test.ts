import { describe, expect, it } from 'vitest';
import {
  BLOCK_TEXT, canOffer, controlState, NOT_ON_EVENT_REASON, OWNER_ONLY, OWNER_ONLY_REASON, parseInvitations, parseOrganisers, publicLine,
  REMOVE_OWNER_ONLY_REASON, viewerRole, withInvited, type Control, type OrganiserRow, type ViewerRole,
} from '../organiserModel';
import { controlFor, inviteOff, removeNote, rowAction } from '../../events/organisersModel';

const owner: OrganiserRow = { pageId: 'o', name: 'Bachata Nights', role: 'owner', status: 'accepted', inviteId: null };
const co: OrganiserRow = { pageId: 'c', name: 'Salsa Crew', role: 'co', status: 'accepted', inviteId: null };
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
  it.each([null, undefined, {}, { organisers: 'x' }])('bad payload %j -> empty', (d) => expect(parseOrganisers(d)).toEqual([]));
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

describe('viewer role (owner / co / non-member)', () => {
  it.each<[string, string[], ViewerRole]>([
    ['owner page', ['o'], 'owner'], ['co page', ['c'], 'co'], ['both: owner wins', ['c', 'o'], 'owner'],
    ['only an invited page: no rights', ['i'], 'none'], ['a stranger', ['z'], 'none'], ['no pages', [], 'none'],
  ])('%s -> %s', (_n, mine, want) => expect(viewerRole(ROWS, mine)).toBe(want));
});

const CONTROLS: Control[] = ['invite', 'cancelInvite', 'removeOrganiser', 'leave', 'end', 'stopRepeating', 'deleteDraft', 'cancelOneOff'];
// role x control -> on?  (owner / co / none)
const ON: Record<Control, [boolean, boolean, boolean]> = {
  invite: [true, true, false], cancelInvite: [true, true, false], removeOrganiser: [true, false, false], leave: [false, true, false],
  end: [true, false, false], stopRepeating: [true, false, false], deleteDraft: [true, false, false], cancelOneOff: [true, false, false],
};

describe('controls: role x control table', () => {
  it.each(CONTROLS.flatMap((c) => (['owner', 'co', 'none'] as ViewerRole[]).map((r, i) => [c, r, ON[c][i]] as const)))(
    '%s as %s -> on=%s, and an off control always says why', (control, role, on) => {
      const s = controlState(role, control);
      expect(s.on).toBe(on);
      expect(s.reason === null).toBe(on);
    });
  it('every owner-only control is off for a co-organiser WITH a reason', () => {
    for (const c of OWNER_ONLY) {
      const s = controlState('co', c);
      expect(s.on).toBe(false);
      expect(s.reason).toBe(c === 'removeOrganiser' ? REMOVE_OWNER_ONLY_REASON : OWNER_ONLY_REASON);
    }
  });
  it('a non-member gets the not-on-event reason everywhere', () => {
    for (const c of CONTROLS) expect(controlState('none', c).reason).toBe(NOT_ON_EVENT_REASON);
  });
  it.each(['ended', 'archived'])('Invite is off on a %s event for everyone, with the lock text; other controls keep their rule', (life) => {
    expect(inviteOff('owner', life)).toMatch(/can't be changed/);
    expect(inviteOff('co', life)).toMatch(/can't be changed/);
    expect(controlFor('owner', life, 'end').on).toBe(true);
  });
  it.each(['live', 'draft', 'paused'])('Invite is on for owner and co on a %s event, off for a non-member', (life) => {
    expect(inviteOff('owner', life)).toBeNull();
    expect(inviteOff('co', life)).toBeNull();
    expect(inviteOff('none', life)).toBe(NOT_ON_EVENT_REASON);
  });
});

describe('rows: Remove / Cancel / Leave', () => {
  const act = (row: OrganiserRow, role: ViewerRole, mine: string[]) => rowAction(row, role, mine);
  it.each<[string, OrganiserRow, ViewerRole, string[], string | null]>([
    ['owner removes a co', co, 'owner', ['o'], 'remove'],
    ['nobody removes the owner (owner viewing)', owner, 'owner', ['o'], null],
    ['nobody removes the owner (co viewing)', owner, 'co', ['c'], null],
    ['co leaves on their own row', co, 'co', ['c'], 'leave'],
    ['co sees no action on another co', { ...co, pageId: 'c2' }, 'co', ['c'], null],
    ['an invited row can be cancelled by an owner', invited, 'owner', ['o'], 'cancel'],
    ['an invited row can be cancelled by a co', invited, 'co', ['c'], 'cancel'],
    ['an invited row without an invite id offers nothing', { ...invited, inviteId: null }, 'owner', ['o'], null],
    ['a non-member gets nothing', co, 'none', ['z'], null],
  ])('%s', (_n, row, role, mine, want) => expect(act(row, role, mine)).toBe(want));
  it('a co sees the only-owner-removes note once; an owner does not', () => {
    expect(removeNote('co', ROWS)).toBe(REMOVE_OWNER_ONLY_REASON);
    expect(removeNote('owner', ROWS)).toBeNull();
    expect(removeNote('co', [owner])).toBeNull();
  });
});

describe('no duplicate organiser or invite', () => {
  it('canOffer is false for a linked or an invited page', () => {
    expect(canOffer(ROWS, 'o')).toBe(false);
    expect(canOffer(ROWS, 'c')).toBe(false);
    expect(canOffer(ROWS, 'i')).toBe(false);
    expect(canOffer(ROWS, 'new')).toBe(true);
  });
  it('withInvited adds a new page once and never twice', () => {
    const once = withInvited(ROWS, { id: 'new', name: 'New' }, 'inv2');
    expect(once).toHaveLength(4);
    expect(withInvited(once, { id: 'new', name: 'New' }, 'inv3')).toHaveLength(4);
    expect(withInvited(ROWS, { id: 'c', name: 'Salsa Crew' }, 'x')).toBe(ROWS);
  });
});

describe('copy and the public line', () => {
  it('block text is the owner wording', () => expect(BLOCK_TEXT).toBe('Every organiser can edit. Only the owner can end the event.'));
  it('public line shows accepted pages only, owner first', () => {
    expect(publicLine(ROWS)).toBe('By Bachata Nights, Salsa Crew');
    expect(publicLine([invited])).toBe('');
  });
});
