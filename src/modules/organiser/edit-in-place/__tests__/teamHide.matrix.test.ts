// caller x target x (hide, show) for canSetHidden, with the caller rows of the
// F5 matrix in admin tests/organiserPublicTeam.db.test.ts (owner, both, manager,
// optout, listed, stranger, no persona, signed-out) plus a seatless platform
// admin, so the UI and set_organiser_team_member_hidden_v1 cannot drift.
// The RPC applies one rule to hide and show alike, so each cell is asserted for both.
import { describe, expect, it } from 'vitest';
import { canSetHidden, type HideCaller, type HideTarget } from '../teamHide';
import { HIDE_ERROR_COPY, hideErrorMessage, parseSetHidden } from '@/modules/organiser/team/publicTeamApi';

const CALLERS: Record<string, HideCaller> = {
  owner: { callerSeat: 'owner', callerPersonId: 'd-owner' },
  both: { callerSeat: 'owner', callerPersonId: 'd-both' }, // owner seat AND a listed team row
  manager: { callerSeat: 'manager', callerPersonId: 'd-manager' },
  optout: { callerSeat: null, callerPersonId: 'd-optout' }, // listed, opted out of the public row
  listed: { callerSeat: null, callerPersonId: 'd-listed' },
  contributor: { callerSeat: 'contributor', callerPersonId: 'd-contrib' },
  stranger: { callerSeat: null, callerPersonId: 'd-stranger' },
  nopersona: { callerSeat: 'manager', callerPersonId: null },
  signedout: { callerSeat: null, callerPersonId: null },
  admin: { callerSeat: null, callerPersonId: 'd-admin' }, // platform admin, no seat
};
const TARGETS: Record<string, HideTarget> = {
  owner: { personId: 'd-owner', isOwner: true },
  otherOwner: { personId: 'd-both', isOwner: true },
  manager: { personId: 'd-manager', isOwner: false },
  listed: { personId: 'd-listed', isOwner: false },
  optout: { personId: 'd-optout', isOwner: false },
  nopersona: { personId: null, isOwner: false },
};
// Expected: which targets each caller gets a control on.
const ALLOWED: Record<string, string[]> = {
  owner: ['owner', 'otherOwner', 'manager', 'listed', 'optout'],
  both: ['owner', 'otherOwner', 'manager', 'listed', 'optout'],
  manager: ['manager', 'listed', 'optout'], // never an owner (owner_protected)
  optout: ['optout'], // self only
  listed: ['listed'], // self only
  contributor: [],
  stranger: [],
  nopersona: ['manager', 'listed', 'optout'],
  signedout: [],
  admin: [], // not_allowed without a seat
};

describe('canSetHidden: caller x target x (hide, show)', () => {
  const cells = Object.keys(CALLERS).flatMap((c) => Object.keys(TARGETS).flatMap((t) => (['hide', 'show'] as const).map((op) => ({ c, t, op, want: ALLOWED[c].includes(t) }))));
  it.each(cells)('$c on $t ($op) -> control $want', ({ c, t, want }) => {
    expect(canSetHidden({ ...CALLERS[c], target: TARGETS[t] })).toBe(want);
  });
  it('a manager looking at an owner row gets no control', () => {
    expect(canSetHidden({ ...CALLERS.manager, target: TARGETS.owner })).toBe(false);
  });
  it('a seatless platform admin gets no control on any row', () => {
    for (const t of Object.values(TARGETS)) expect(canSetHidden({ ...CALLERS.admin, target: t })).toBe(false);
  });
});

describe('hide/show refusal copy: one mapping', () => {
  it.each(Object.entries(HIDE_ERROR_COPY))('%s -> its own words', (code, copy) => {
    expect(hideErrorMessage({ message: code, hint: 'server words' })).toBe(copy);
  });
  it('the six codes are exactly the RPC refusals', () => {
    expect(Object.keys(HIDE_ERROR_COPY).sort()).toEqual(['invalid_input', 'not_allowed', 'not_signed_in', 'organiser_not_found', 'owner_protected', 'person_not_on_team']);
  });
  it('a network error or an unknown code falls back to the generic team error', () => {
    const generic = hideErrorMessage({ message: 'zzz_unknown' });
    expect(hideErrorMessage(new TypeError('Failed to fetch'))).toBe(generic);
    expect(generic).not.toMatch(/zzz/);
  });
  it('changed:false is success; a bad shape throws', () => {
    expect(parseSetHidden({ ok: true, organiser_profile_id: 'o', person_id: 'd', hidden: true, changed: false })).toEqual({ personId: 'd', hidden: true, changed: false });
    expect(() => parseSetHidden({ ok: true })).toThrow('set_hidden_bad_shape');
  });
});
