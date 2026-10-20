import { describe, expect, it } from 'vitest';
import { KNOWN_SELF_SERVE_CODES, commandErrorMessage, isVersionConflict, selfServeErrorCode, selfServeErrorCopy, teamErrorMessage } from '../selfServeErrors';
import { TEAM_CAP } from '../teamModel';
import { isMailboxProvenToken } from '../sessionProof';
import { DANCER_GATE_REASON, PROFILE_INCOMPLETE_CODE } from '@/lib/accountRouting';
import { PROFILE_INCOMPLETE_ERROR } from '@/hooks/useSeriesLevelRating';

// Every refusal the D4 RPCs (admin repo 20261108200000-260000) and their shared
// helper can raise to a signed-in caller. A code missing here would reach the
// user as "Something went wrong".
const SERVER_CODES = [
  'authentication_required', 'mailbox_unproven', 'auth_user_email_missing',
  'organiser_id_required', 'organiser_not_found', 'not_live', 'organiser_already_claimed',
  'no_contact_email', 'email_mismatch', 'already_member', 'message_too_long', 'message_invalid',
  'request_already_open', 'request_limit_reached', 'name_required', 'name_too_long', 'name_invalid',
  'city_required', 'city_not_found', 'contact_email_not_own', 'invalid_instagram', 'invalid_website',
  'organiser_name_taken', 'draft_limit_reached',
  // D6 submit_organiser_profile_v1 (admin 20261109110000).
  'not_authorised', 'invalid_state',
  // Dancer first, then organiser: create / claim / request refuse an unfinished dancer profile (separate admin PR).
  'profile_incomplete',
  // S-ERR: the invite-only create trigger (admin) and the 20-person cap (admin A1b).
  'organiser_invite_required', 'team_full',
];

const token = (payload: unknown) =>
  `x.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`;

describe('selfServeErrors S-ERR', () => {
  it.each(['organiser_invite_required', 'team_full'])('%s maps to its own message, not the generic line', (code) => {
    const copy = selfServeErrorCopy({ message: code, code: 'P0001' });
    expect(copy.message).not.toBe('Something went wrong. Please try again.');
    expect(KNOWN_SELF_SERVE_CODES).toContain(code);
  });

  it('organiser_invite_required carries the invite copy and offers the support link', () => {
    const copy = selfServeErrorCopy({ message: 'organiser_invite_required' });
    expect(copy.message).toBe('Creating a new organiser page needs an invite from the Bachata Calendar team. Message us and we\u2019ll set you up.');
    expect(copy.next).toBe('contact_support');
  });

  it('team_full takes its number from TEAM_CAP', () => {
    expect(selfServeErrorCopy({ message: 'team_full' }).message).toBe(`This team already has ${TEAM_CAP} people. Remove someone first, or ask the Bachata Calendar team.`);
    expect(teamErrorMessage({ message: 'team_full' })).toBe(selfServeErrorCopy({ message: 'team_full' }).message);
  });
});

describe('selfServeErrors', () => {
  it('has copy for every code the server raises', () => {
    expect(SERVER_CODES.filter((c) => !KNOWN_SELF_SERVE_CODES.includes(c))).toEqual([]);
  });

  it('an unfinished dancer profile refusal sends the person to finish it, with the gate\'s own words', () => {
    const copy = selfServeErrorCopy({ message: PROFILE_INCOMPLETE_CODE, code: 'P0001' });
    expect(copy.next).toBe('finish_profile');
    expect(copy.message).toBe(DANCER_GATE_REASON);
    // The rating RPC's refusal and this one are the same string.
    expect(PROFILE_INCOMPLETE_CODE).toBe('profile_incomplete');
    expect(PROFILE_INCOMPLETE_ERROR).toBe(PROFILE_INCOMPLETE_CODE);
  });

  it('reads the code from a PostgREST error message', () => {
    expect(selfServeErrorCode({ message: 'email_mismatch', code: 'P0001' })).toBe('email_mismatch');
  });

  it('never surfaces raw server text', () => {
    const raw = { message: 'permission denied for table organiser_profiles' };
    expect(selfServeErrorCode(raw)).toBeNull();
    expect(selfServeErrorCopy(raw).message).toBe('Something went wrong. Please try again.');
    expect(selfServeErrorCopy({ message: 'some_future_code' }).message).toBe('Something went wrong. Please try again.');
  });

  it('explains each submit refusal in plain words', () => {
    expect(selfServeErrorCopy({ message: 'invalid_state', code: 'P0001' }).message).toBe(
      'This page cannot do that right now. Reload and check it.',
    );
    expect(selfServeErrorCopy({ message: 'not_authorised' }).message).toBe(
      'Only an owner or manager of this page can do that.',
    );
    expect(selfServeErrorCopy({ message: 'organiser_not_found' }).message).toBe('That organiser no longer exists.');
    expect(selfServeErrorCopy({ message: 'authentication_required' }).next).toBe('sign_in');
  });

  it('routes a claim refusal to "request access" and an unproven mailbox to re-auth', () => {
    expect(selfServeErrorCopy({ message: 'email_mismatch' }).next).toBe('request_access');
    expect(selfServeErrorCopy({ message: 'organiser_already_claimed' }).next).toBe('request_access');
    expect(selfServeErrorCopy({ message: 'mailbox_unproven' }).next).toBe('reauth');
    expect(selfServeErrorCopy({ message: 'request_already_open' }).next).toBeNull();
  });
});

describe('isMailboxProvenToken', () => {
  it('accepts an email-code or magic-link session', () => {
    expect(isMailboxProvenToken(token({ amr: [{ method: 'otp', timestamp: 1 }] }))).toBe(true);
    expect(isMailboxProvenToken(token({ amr: [{ method: 'magiclink', timestamp: 1 }] }))).toBe(true);
  });

  it('refuses a password session, a missing amr and garbage', () => {
    expect(isMailboxProvenToken(token({ amr: [{ method: 'password', timestamp: 1 }] }))).toBe(false);
    expect(isMailboxProvenToken(token({ sub: 'u' }))).toBe(false);
    expect(isMailboxProvenToken('not-a-jwt')).toBe(false);
    expect(isMailboxProvenToken(null)).toBe(false);
  });
});

describe('commandErrorMessage (series and date commands)', () => {
  // Real messages from apply_aggregate_write_p5 and its handlers (admin repo,
  // 20261108180000 and the handler bodies read on E2E 2026-10-04).
  const cases: Array<[string, RegExp]> = [
    ['version_conflict: expected 3, got 4', /^Someone changed this first\. Check it\.$/],
    ['permission_denied: occurrence.cancel on a past date is admin-only', /already happened/],
    ['past_date: break on 2026-10-01 is already past and cannot be restored', /already happened/],
    ['has_bookings: occurrence x on 2026-10-11 has attendance or guest-list entries and cannot be deleted (cancel it instead)', /Cancel it instead/],
    ['no_sessions_for_time_override: this date has no sessions; add one in the date editor first (occurrence_id=x)', /no session times/],
    ['permission_denied: occurrence.cancel needs a reason that is a cancellation_reasons label', /Choose a reason/],
    ['permission_denied: occurrence.set_override ticket_url must be blank or an http(s) URL', /https:\/\//],
    ['permission_denied: series.upsert default_cover_image_url must be blank or an http(s) URL', /https:\/\//],
    ['permission_denied: occurrence.set_override venue_id must name an existing venue', /venue is not on Bachata Calendar/],
    ['permission_denied: series.set_lifecycle live -> draft is not an owner transition', /status change/],
    ['invalid_transition: 2026-10-18 is not a date the recurrence rule of series x generates -- the rule changed', /Add it as a date instead/],
    ['permission_denied: caller does not own series 123', /cannot make that change/],
    ['permission_denied: occurrence.set_override keys are admin-only: title', /cannot make that change/],
    ['invalid_payload: name required', /Enter the event name/],
  ];

  it.each(cases)('%s', (message, expected) => {
    expect(commandErrorMessage({ message, code: 'P0001' })).toMatch(expected);
  });

  // INT4: the final AW1 refusals (admin PR #838, AW1-fix.md B-1/B-2 and AW1-fix2.md S-1), exact server texts.
  describe('AW1 programme and organiser refusals', () => {
    const aw1: Array<[string, RegExp, string[]]> = [
      ['permission_denied: removing the session "Beginners footwork" would delete its per-date changes; ask an admin to remove it',
        /^The session \u201cBeginners footwork\u201d has changes on some dates[\s\S]*only an admin can remove it[\s\S]*ask the Bachata Calendar team/, ['permission_denied', 'per-date']],
      ['invalid_payload: this programme save carries no ids but the series has per-date changes; reload the editor and save again',
        /Reload the page/, ['invalid_payload', 'ids']],
      ['permission_denied: series.set_organisers can only add an organiser page you own or manage; ask an admin to add another page',
        /only add organiser pages you run[\s\S]*Bachata Calendar team/, ['permission_denied', 'set_organisers']],
      ['invalid_payload: a programme id must be blank or a uuid', /Reload the page/, ['invalid_payload', 'uuid']],
      ['invalid_payload: a programme id appears more than once', /Reload the page/, ['invalid_payload']],
      ['invalid_payload: a programme id does not belong to this series', /Reload the page/, ['invalid_payload']],
      // FIX-INT4 S-1: the server sends left(title, 80) and prod has sessions titled '' WITH per-date changes.
      ['permission_denied: removing the session "" would delete its per-date changes; ask an admin to remove it',
        /^One of the sessions has changes on some dates, so only an admin can remove it\. Keep it, or ask the Bachata Calendar team to remove it\.$/, ['permission_denied', 'per-date', '\u201c']],
      ['permission_denied: removing the session "   " would delete its per-date changes; ask an admin to remove it',
        /^One of the sessions has changes on some dates/, ['permission_denied', '\u201c']],
      // FIX-INT4 S-3: the title is free text; an earlier unanchored rule must not see it first.
      ['permission_denied: removing the session "Bachata on a past date is admin-only" would delete its per-date changes; ask an admin to remove it',
        /^The session \u201cBachata on a past date is admin-only\u201d has changes on some dates/, ['permission_denied', 'per-date']],
      ['permission_denied: removing the session "Drill: shift would collide" would delete its per-date changes; ask an admin to remove it',
        /^The session \u201cDrill: shift would collide\u201d has changes on some dates/, ['permission_denied', 'per-date']],
      // FIX-INT4 N-2: the exact server text (admin 20261126230000, the live check on an ADDED page).
      ['permission_denied: series.set_organisers can only add a live organiser page',
        /^That page isn't live, so it can't be added\.$/, ['permission_denied', 'set_organisers']],
    ];

    // FIX-INT4 N-1: the 80-character cut (the server already sends left(title, 80); this pins the client's own clamp).
    it('a 120-character session title is cut to its first 80 characters', () => {
      const title = `${'x'.repeat(80)}${'z'.repeat(40)}`;
      const text = commandErrorMessage({ message: `permission_denied: removing the session "${title}" would delete its per-date changes; ask an admin to remove it`, code: 'P0001' });
      expect(text).toContain(`\u201c${'x'.repeat(80)}\u201d`);
      expect(text).not.toContain('z');
    });

    it.each(aw1)('%s', (message, expected, leaks) => {
      const text = commandErrorMessage({ message, code: 'P0001' });
      expect(text).toMatch(expected);
      for (const raw of leaks) expect(text).not.toContain(raw);
      expect(text.length).toBeLessThan(200);
    });
  });

  describe('bare refusal codes from the admin caps and undo', () => {
    const codes: Array<[string, RegExp]> = [
      ['daily_edit_cap', /limit of 100 changes[\s\S]*tomorrow[\s\S]*Bachata Calendar team/],
      ['date_cap', /30 or more upcoming dates[\s\S]*past and cancelled dates do not count[\s\S]*upcoming date first[\s\S]*new event/],
      ['undo_conflict', /Someone changed this after you[\s\S]*before you change it again/],
      ['not_undoable', /cannot be undone here[\s\S]*by hand/],
    ];

    it.each(codes)('%s maps to its message and never leaks the code', (code, expected) => {
      for (const message of [code, `${code}: detail the server may add`]) {
        const text = commandErrorMessage({ message, code: 'P0001' });
        expect(text).toMatch(expected);
        expect(text).not.toContain(code);
        expect(text.length).toBeLessThan(200);
      }
    });
  });

  describe('real full server messages for the caps', () => {
    const real: Array<[string, RegExp]> = [
      ['permission_denied: daily_edit_cap: this account made 100 changes in the last 24 hours (cap 100); try again later', /limit of 100 changes[\s\S]*tomorrow[\s\S]*Bachata Calendar team/],
      ['permission_denied: date_cap: this series already has 30 upcoming dates (cap 30); remove or cancel one before adding another', /30 or more upcoming dates[\s\S]*past and cancelled dates do not count[\s\S]*upcoming date first[\s\S]*new event/],
    ];

    it.each(real)('%s', (message, expected) => {
      const text = commandErrorMessage({ message, code: 'P0001' });
      expect(text).toMatch(expected);
      expect(text).not.toMatch(/cannot make that change/);
      expect(text).not.toContain('_cap');
    });
  });

  it('never shows raw server text', () => {
    for (const message of ['relation "x" does not exist', 'some new refusal', '']) {
      expect(commandErrorMessage({ message })).toBe('Something went wrong. Please try again.');
    }
    expect(commandErrorMessage(null)).toBe('Something went wrong. Please try again.');
  });

  it('spots a version conflict', () => {
    expect(isVersionConflict({ message: 'version_conflict: expected 1, got 2' })).toBe(true);
    expect(isVersionConflict({ message: 'permission_denied' })).toBe(false);
  });
});
