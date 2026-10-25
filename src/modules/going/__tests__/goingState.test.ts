/**
 * THE going mapping, table-driven: every refusal code, every viewer x night
 * shape, the night-ended rule (end time, else 04:00 London next morning) and
 * the words for the two commonest states ("0 going", "finish your profile").
 */
import { describe, expect, it } from 'vitest';
import { PROFILE_FIELDS, type ProfileField } from '@/lib/profileCompletion';
import {
  GOING_COPY,
  GOING_REFUSAL_CODES,
  finishProfileLinkFor,
  goingCountText,
  goingErrorCode,
  goingNightEnded,
  goingNightOpenUntil,
  goingNightStatus,
  goingStateFor,
  goingStateForRefusal,
  moreText,
  nightLine,
  unfinishedText,
  type GoingErrorCode,
  type GoingNightStatus,
  type GoingStateKind,
  type GoingViewer,
} from '@/modules/going';

const finished: GoingViewer = { kind: 'finished' };

describe('every refusal code maps to a state', () => {
  const expected: Record<GoingRefusalCodeOrOther, { notGoing: GoingStateKind; going: GoingStateKind }> = {
    not_signed_in: { notGoing: 'signed_out', going: 'signed_out' },
    anonymous_session: { notGoing: 'anonymous', going: 'anonymous' },
    invalid_argument: { notGoing: 'error', going: 'error' },
    not_found: { notGoing: 'error', going: 'error' },
    event_not_live: { notGoing: 'event_not_live', going: 'event_not_live' },
    night_cancelled: { notGoing: 'night_cancelled', going: 'night_cancelled' },
    night_ended: { notGoing: 'night_ended', going: 'night_ended' },
    profile_incomplete: { notGoing: 'profile_unfinished', going: 'going' },
    rate_limited: { notGoing: 'rate_limited', going: 'rate_limited' },
    too_many_ids: { notGoing: 'error', going: 'error' },
    // The organiser read's own refusal (get_my_event_going_v1); set_my_going_v1 never raises it.
    not_organiser: { notGoing: 'error', going: 'error' },
    network: { notGoing: 'error', going: 'error' },
    unknown: { notGoing: 'error', going: 'error' },
  };
  type GoingRefusalCodeOrOther = GoingErrorCode;

  it('the table names every refusal code the database raises', () => {
    for (const code of GOING_REFUSAL_CODES) expect(Object.keys(expected)).toContain(code);
  });

  it.each(Object.entries(expected))('%s', (code, want) => {
    expect(goingStateForRefusal(code as GoingErrorCode, false)).toBe(want.notGoing);
    expect(goingStateForRefusal(code as GoingErrorCode, true)).toBe(want.going);
    const v = goingStateFor({ viewer: finished, night: 'live', going: false, error: code as GoingErrorCode, count: 2 });
    // Every refusal state says something, and a disabled control always has its reason.
    expect(v.words).toBeTruthy();
    if (!v.control.enabled) expect(v.control.reason).toBeTruthy();
  });

  it('a profile_incomplete refusal for a viewer the client thought finished links to the Finish screen', () => {
    const v = goingStateFor({ viewer: finished, night: 'live', going: false, error: 'profile_incomplete', returnTo: '/event/x' });
    expect(v.state).toBe('profile_unfinished');
    expect(v.words).toBe(GOING_COPY.unfinishedGeneral);
    expect(v.link?.to).toBe('/finish-profile?returnTo=%2Fevent%2Fx');
    expect(v.control.enabled).toBe(false);
  });
});

describe('goingErrorCode reads the code, never display text', () => {
  it.each([
    [{ message: 'rate_limited' }, 'rate_limited'],
    [{ message: 'night_ended: the night is over' }, 'night_ended'],
    [{ message: 'profile_incomplete' }, 'profile_incomplete'],
    [{ message: 'permission denied for function set_my_going_v1', code: '42501' }, 'not_signed_in'],
    [{ message: 'permission denied for function get_my_going_v1' }, 'not_signed_in'],
    [{ message: 'too_many_ids' }, 'too_many_ids'],
    [new TypeError('Failed to fetch'), 'network'],
    [{ message: 'something else' }, 'unknown'],
    [null, 'unknown'],
  ] as const)('%o -> %s', (err, code) => {
    expect(goingErrorCode(err)).toBe(code);
  });
  it.each(GOING_REFUSAL_CODES)('%s round-trips', (code) => expect(goingErrorCode({ message: code })).toBe(code));
});

// ---------------------------------------------------------------- viewer x night

const VIEWERS: Record<string, GoingViewer> = {
  loading: { kind: 'loading' },
  signed_out: { kind: 'signed_out' },
  anonymous: { kind: 'anonymous' },
  no_profile: { kind: 'no_profile' },
  unfinished_role: { kind: 'unfinished', missing: ['dance_role'] },
  unfinished_all: { kind: 'unfinished', missing: [...PROFILE_FIELDS] },
  unfinished_unknown_fields: { kind: 'unfinished', missing: [] },
  unknown: { kind: 'unknown' },
  finished,
};
const NIGHTS: GoingNightStatus[] = ['live', 'ended', 'cancelled', 'not_live'];

/** What each cell must be: [state, enabled, action]. */
const expectCell = (viewer: string, night: GoingNightStatus, going: boolean): [GoingStateKind, boolean, string] => {
  const signedIn = !['loading', 'signed_out', 'anonymous'].includes(viewer);
  const isGoing = going && signedIn;
  // Un-going is always allowed, an ended night included.
  if (night === 'ended') return isGoing ? ['night_ended', true, 'ungo'] : ['night_ended', false, 'none'];
  if (night === 'cancelled') return isGoing ? ['night_cancelled', true, 'ungo'] : ['night_cancelled', false, 'none'];
  if (night === 'not_live') return isGoing ? ['event_not_live', true, 'ungo'] : ['event_not_live', false, 'none'];
  if (viewer === 'loading') return ['loading', false, 'none'];
  if (viewer === 'signed_out') return ['signed_out', true, 'sign_in'];
  if (viewer === 'anonymous') return ['anonymous', true, 'sign_in'];
  if (isGoing) return ['going', true, 'ungo'];
  if (viewer === 'no_profile' || viewer.startsWith('unfinished')) return ['profile_unfinished', false, 'none'];
  return ['can_tap', true, 'go'];
};

describe('viewer x night x going', () => {
  const rows = Object.keys(VIEWERS).flatMap((v) => NIGHTS.flatMap((n) => [false, true].map((g) => [v, n, g] as const)));
  it.each(rows)('%s / %s / going=%s', (viewer, night, going) => {
    const v = goingStateFor({ viewer: VIEWERS[viewer], night, going, count: 3, returnTo: '/event/abc' });
    const [state, enabled, action] = expectCell(viewer, night, going);
    expect(v.state).toBe(state);
    expect(v.control.enabled).toBe(enabled);
    expect(v.control.action).toBe(action);
    // Never "Interested"; a disabled button always says why; a link only with words beside it.
    expect(v.control.label).not.toMatch(/interested/i);
    if (!enabled) expect(v.control.reason).toBeTruthy();
    if (v.link) expect(v.words).toBeTruthy();
    // aria-pressed tells the truth.
    expect(v.control.pressed).toBe(v.going);
  });
});

describe('the commonest states read well', () => {
  it('0 going invites the viewer to be first, pointing at the button on screen', () => {
    const v = goingStateFor({ viewer: finished, night: 'live', going: false, count: 0 });
    expect(v.state).toBe('can_tap');
    expect(v.words).toBe(GOING_COPY.beFirst);
    expect(v.words).toContain(v.control.label);
  });
  it('someone going: no invitation line', () => {
    expect(goingStateFor({ viewer: finished, night: 'live', going: false, count: 4 }).words).toBeNull();
  });

  const FIELDS: [ProfileField[], string][] = [
    [['first_name'], 'Add your first name to say you\u2019re going.'],
    [['based_city_id'], 'Add your city to say you\u2019re going.'],
    [['dance_role'], 'Add your dance role to say you\u2019re going.'],
    [['avatar_url'], 'Add your photo to say you\u2019re going.'],
    [['dance_role', 'avatar_url'], 'Add your dance role and photo to say you\u2019re going.'],
    [[...PROFILE_FIELDS], 'Add your first name, city, dance role and photo to say you\u2019re going.'],
  ];
  const href = '/finish-profile?returnTo=%2Fevent%2Fabc';
  it.each(FIELDS)('unfinished %j names what is missing and links to the Finish screen', (missing, words) => {
    const v = goingStateFor({ viewer: { kind: 'unfinished', missing }, night: 'live', going: false, count: 0, returnTo: '/event/abc' });
    expect(v.state).toBe('profile_unfinished');
    expect(v.words).toBe(words);
    expect(v.control.reason).toBe(words);
    expect(v.link).toEqual({ to: href, label: GOING_COPY.finishLink, external: false });
    expect(unfinishedText(missing)).toBe(words);
  });
  it('the Finish screen comes back to where the viewer was', () => {
    expect(finishProfileLinkFor('/event/a?occurrenceId=b')).toBe(
      '/finish-profile?returnTo=%2Fevent%2Fa%3FoccurrenceId%3Db',
    );
  });
  it('no dancer profile: disabled, says why, offers the message-us link', () => {
    const v = goingStateFor({ viewer: { kind: 'no_profile' }, night: 'live', going: false });
    expect(v.words).toBe(GOING_COPY.noProfile);
    expect(v.link?.external).toBe(true);
  });
  it('an unfinished profile that is already going can still undo', () => {
    const v = goingStateFor({ viewer: VIEWERS.unfinished_role, night: 'live', going: true });
    expect(v.state).toBe('going');
    expect(v.control).toMatchObject({ enabled: true, action: 'ungo', pressed: true });
    expect(v.words).toBe(GOING_COPY.goingUndoHint);
  });
});

describe('loading and in flight', () => {
  it('signed in, own going not known yet: loading, disabled, says so', () => {
    const v = goingStateFor({ viewer: finished, night: 'live', going: null });
    expect(v.state).toBe('loading');
    expect(v.control.enabled).toBe(false);
    expect(v.control.reason).toBe(GOING_COPY.loading);
  });
  it('a save in flight shows the optimistic value and waits', () => {
    const v = goingStateFor({ viewer: finished, night: 'live', going: true, pending: true });
    expect(v.state).toBe('going');
    expect(v.control).toMatchObject({ enabled: false, busy: true, reason: GOING_COPY.saving, pressed: true });
  });
  it('ended night, going: words say so and un-going stays enabled', () => {
    const v = goingStateFor({ viewer: finished, night: 'ended', going: true });
    expect(v).toMatchObject({ state: 'night_ended', going: true, words: GOING_COPY.endedGoing });
    expect(v.control).toMatchObject({ enabled: true, action: 'ungo', pressed: true });
  });
  // Un-going lands on a disabled optimistic state: it must still show the save in flight.
  const PENDING_DISABLED: [string, GoingViewer, GoingNightStatus][] = [
    ['cancelled night', finished, 'cancelled'],
    ['event not live', finished, 'not_live'],
    ['ended night', finished, 'ended'],
    ['unfinished profile', VIEWERS.unfinished_role, 'live'],
    ['no profile', VIEWERS.no_profile, 'live'],
  ];
  it.each(PENDING_DISABLED)('un-going in flight (%s) shows Saving', (_label, viewer, night) => {
    const v = goingStateFor({ viewer, night, going: false, pending: true, returnTo: '/event/abc' });
    expect(v.going).toBe(false);
    expect(v.control).toMatchObject({ enabled: false, busy: true, reason: GOING_COPY.saving });
  });
  it('rate limited and network errors keep the button usable', () => {
    expect(goingStateFor({ viewer: finished, night: 'live', going: false, error: 'rate_limited' }).control.enabled).toBe(true);
    const net = goingStateFor({ viewer: finished, night: 'live', going: true, error: 'network' });
    expect(net).toMatchObject({ state: 'error', words: GOING_COPY.network, going: true });
    expect(net.control.action).toBe('ungo');
  });
});

describe('the night rule', () => {
  // 2026-10-29 is a Thursday, London on GMT (UTC+0); 2026-07-02 is BST (UTC+1).
  it('with an end time, it ends at the end time', () => {
    expect(goingNightOpenUntil('2026-10-29 21:00:00', '2026-10-30 02:00:00')).toBe('2026-10-30T02:00:00');
    expect(goingNightEnded('2026-10-29 21:00:00', '2026-10-30 02:00:00', new Date('2026-10-30T01:59:00Z'))).toBe(false);
    expect(goingNightEnded('2026-10-29 21:00:00', '2026-10-30 02:00:00', new Date('2026-10-30T02:00:00Z'))).toBe(true);
  });
  it('with no end time, it stays open until 04:00 London the next morning', () => {
    expect(goingNightOpenUntil('2026-10-29T21:00:00', null)).toBe('2026-10-30T04:00:00');
    expect(goingNightEnded('2026-10-29T21:00:00', null, new Date('2026-10-30T03:59:00Z'))).toBe(false);
    expect(goingNightEnded('2026-10-29T21:00:00', null, new Date('2026-10-30T04:00:00Z'))).toBe(true);
  });
  it('reads London wall clock in BST too (04:00 London = 03:00 UTC)', () => {
    expect(goingNightEnded('2026-07-02 21:00:00', null, new Date('2026-07-03T02:59:00Z'))).toBe(false);
    expect(goingNightEnded('2026-07-02 21:00:00', null, new Date('2026-07-03T03:00:00Z'))).toBe(true);
  });
  // event_view_p5 snapshot_compat stamps the London wall clock "+00:00"
  // (materialised_start_utc is local-as-Z; get_my_going_v1 reads it "via UTC").
  // The digits ARE London: converting the stamp as a true UTC instant would put
  // a BST night an hour late. A night ending 23:00 London on Friday 23 October
  // 2026 (BST) has ended at 22:00Z.
  it('a snapshot stamp "+00:00" is the London wall clock, read as stored (BST night)', () => {
    const start = '2026-10-23T19:00:00+00:00';
    const end = '2026-10-23T23:00:00+00:00';
    expect(goingNightEnded(start, end, new Date('2026-10-23T21:59:00Z'))).toBe(false);
    expect(goingNightEnded(start, end, new Date('2026-10-23T22:00:00Z'))).toBe(true);
    expect(goingNightEnded(start, null, new Date('2026-10-24T02:59:00Z'))).toBe(false);
    expect(goingNightEnded(start, null, new Date('2026-10-24T03:00:00Z'))).toBe(true);
  });
  it('a date-only start also runs to 04:00 next morning; an unreadable one never ends', () => {
    expect(goingNightOpenUntil('2026-10-29', null)).toBe('2026-10-30T04:00:00');
    expect(goingNightOpenUntil(null, null)).toBeNull();
    expect(goingNightEnded('garbage', null, new Date())).toBe(false);
  });
  it('status order: cancelled > ended > not live > live; no clock yet = not ended', () => {
    const past = { startsAtLocal: '2020-01-01 21:00', isCancelled: false, eventLive: true };
    expect(goingNightStatus({ ...past, isCancelled: true }, new Date())).toBe('cancelled');
    expect(goingNightStatus({ ...past, eventLive: false }, new Date())).toBe('ended');
    expect(goingNightStatus(past, null)).toBe('live');
    expect(goingNightStatus({ ...past, startsAtLocal: '2099-01-01 21:00', eventLive: false }, new Date())).toBe('not_live');
    expect(goingNightStatus({ ...past, startsAtLocal: '2099-01-01 21:00' }, new Date())).toBe('live');
  });
});

describe('copy helpers', () => {
  it.each([
    [0, false, 'No one going yet'],
    [1, false, '1 going'],
    [12, false, '12 going'],
    [0, true, 'No one said they were going'],
    [5, true, '5 went'],
  ] as const)('goingCountText(%s, past=%s) = %s', (n, past, text) => expect(goingCountText(n, past)).toBe(text));
  it('moreText', () => {
    expect(moreText(0)).toBe('');
    expect(moreText(192)).toBe('+192 more');
  });
  it.each([
    ['2026-10-29 21:00:00', 'Thursday 29 Oct \u00b7 9 PM'],
    ['2026-10-29T21:30:00+00', 'Thursday 29 Oct \u00b7 9:30 PM'],
    ['2026-11-01', 'Sunday 1 Nov'],
    ['2026-10-30 00:00:00', 'Friday 30 Oct \u00b7 12 AM'],
    [null, null],
  ] as const)('nightLine(%s) = %s (full weekday, read as stored)', (raw, line) => expect(nightLine(raw)).toBe(line));
  it('no word in the copy offers "Interested"', () => {
    for (const v of Object.values(GOING_COPY)) if (typeof v === 'string') expect(v).not.toMatch(/interested/i);
  });
});
