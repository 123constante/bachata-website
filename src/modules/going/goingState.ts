/**
 * THE going mapping (Going P2). One pure function turns the facts about a
 * viewer and a night into what every surface shows: the state, the words, the
 * button (enabled or disabled WITH a reason) and the link. The event page tile,
 * the festival hub rows and the dancer app all read it; none has its own rule.
 *
 * The database is the authority (admin docs/handovers/going-p1-db.md):
 * set_my_going_v1 refuses with one of GOING_REFUSAL_CODES as the error
 * message. Every code maps to a state here (goingState.test.ts proves it for
 * each one). The client facts only decide what to SHOW before a tap; whatever
 * the server answers wins.
 *
 * Owner decisions: only FINISHED profiles may say going (profile_complete_v1 =
 * first_name, based_city_id, dance_role, avatar_url); un-going is always
 * allowed by the database, so a person who is going can take their name off a
 * cancelled night, a paused event or with an unfinished profile. An ENDED night
 * is a record ("Who went") and its button is off.
 */
import { addDaysToKey, londonWallClockNowIso } from '@/lib/londonDate';
import { NO_PROFILE_CONTACT_URL, finishProfileHref, listFieldLabels, type ProfileField } from '@/lib/profileCompletion';
import { GOING_COPY, unfinishedWords } from './goingCopy';

/** "Add your dance role to say you're going." -- names every missing field (words: goingCopy). */
export const unfinishedText = (missing: readonly ProfileField[]): string =>
  unfinishedWords(missing.length === 0 ? '' : listFieldLabels(missing));

// ---------------------------------------------------------------- refusals

/** Every refusal set_my_going_v1 / get_my_going_v1 raise, as the error `message`. */
export const GOING_REFUSAL_CODES = [
  'not_signed_in',
  'anonymous_session',
  'invalid_argument',
  'not_found',
  'event_not_live',
  'night_cancelled',
  'night_ended',
  'profile_incomplete',
  'rate_limited',
  /** get_nights_going_v1 with more than 200 ids (fetchNightsGoing chunks at 200, so never expected). */
  'too_many_ids',
] as const;
export type GoingRefusalCode = (typeof GOING_REFUSAL_CODES)[number];
/** A refusal, a network failure, or anything else. */
export type GoingErrorCode = GoingRefusalCode | 'network' | 'unknown';

const isRefusal = (v: string): v is GoingRefusalCode => (GOING_REFUSAL_CODES as readonly string[]).includes(v);

/** The error of a going RPC (or a thrown fetch) -> its code. Never parses display text. */
export const goingErrorCode = (error: unknown): GoingErrorCode => {
  if (error === null || error === undefined) return 'unknown';
  const e = error as { message?: unknown; code?: unknown; name?: unknown };
  const message = typeof e.message === 'string' ? e.message.trim() : '';
  const head = message.split(/[\s:]/, 1)[0] ?? '';
  if (isRefusal(message)) return message;
  if (isRefusal(head)) return head;
  // anon has no EXECUTE on set_my_going_v1 / get_my_going_v1: PostgreSQL's own
  // 42501 "permission denied for function" reaches a signed-out caller, never not_signed_in.
  if (e.code === '42501' || /permission denied/i.test(message)) return 'not_signed_in';
  if (e.name === 'TypeError' || /failed to fetch|network|load failed|fetch failed/i.test(message)) return 'network';
  return 'unknown';
};

// ---------------------------------------------------------------- night

export type GoingNightStatus = 'live' | 'ended' | 'cancelled' | 'not_live';

export type GoingNightFacts = {
  /** London wall clock with NO zone ('YYYY-MM-DD HH:mm[:ss]' or 'T'); read as stored. */
  startsAtLocal: string | null | undefined;
  /** Same convention; null = the night has no end time. */
  endsAtLocal?: string | null;
  isCancelled: boolean;
  /** The event (series) is live. Paused / ended / draft = false. */
  eventLive: boolean;
};

const NAIVE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

const naiveStamp = (s: string | null | undefined): { date: string; stamp: string | null } | null => {
  const m = (s ?? '').match(NAIVE);
  if (!m) return null;
  const [, date, hh, mm, ss] = m;
  return { date, stamp: hh === undefined ? null : `${date}T${hh}:${mm}:${ss ?? '00'}` };
};

/** The hour (London) a night with no end time stays open until, the next morning. */
export const GOING_OPEN_UNTIL_HOUR = '04:00:00';

/**
 * When the night stops taking names, as a London wall-clock stamp
 * 'YYYY-MM-DDTHH:mm:ss': its end time if it has one, else 04:00 London the next
 * morning. null when the start is unreadable (then nothing counts as ended).
 */
export const goingNightOpenUntil = (
  startsAtLocal: string | null | undefined,
  endsAtLocal?: string | null,
): string | null => {
  const end = naiveStamp(endsAtLocal);
  if (end?.stamp) return end.stamp;
  const start = naiveStamp(startsAtLocal);
  if (!start) return null;
  return `${addDaysToKey(start.date, 1)}T${GOING_OPEN_UNTIL_HOUR}`;
};

/** Has the night ended at `now` (a true instant)? Compares London wall clocks as strings. */
export const goingNightEnded = (
  startsAtLocal: string | null | undefined,
  endsAtLocal: string | null | undefined,
  now: Date,
): boolean => {
  const until = goingNightOpenUntil(startsAtLocal, endsAtLocal);
  return until !== null && londonWallClockNowIso(now) >= until;
};

/**
 * The night's status. `now` null = the clock has not been read yet (server
 * render / first paint): the night is not called ended until it has.
 * Cancelled wins over ended, ended over a paused event.
 */
export const goingNightStatus = (f: GoingNightFacts, now: Date | null): GoingNightStatus => {
  if (f.isCancelled) return 'cancelled';
  if (now && goingNightEnded(f.startsAtLocal, f.endsAtLocal ?? null, now)) return 'ended';
  if (!f.eventLive) return 'not_live';
  return 'live';
};

// ---------------------------------------------------------------- viewer

export type GoingViewer =
  /** Auth not resolved yet. */
  | { kind: 'loading' }
  | { kind: 'signed_out' }
  | { kind: 'anonymous' }
  /** Signed in, but no dancer profile at all. */
  | { kind: 'no_profile' }
  /**
   * Signed in, profile not finished. `missing` = the required fields still
   * empty, in profile order ([] = not known which).
   */
  | { kind: 'unfinished'; missing: readonly ProfileField[] }
  | { kind: 'finished' }
  /** Signed in, completeness not known (loading / check failed): the tap is allowed, the server decides. */
  | { kind: 'unknown' };

/**
 * Where "Finish your profile" goes: the site's ONE Finish screen
 * (lib/profileCompletion, the same one the rating gate uses), which edits the
 * four required fields and comes back to `returnTo`. Not the dancer app's own
 * edit screen: the going module sits outside src/modules/dancer-app and may not
 * import it (scripts/check-dancer-area-isolation.mjs rule (c)).
 */
export const finishProfileLinkFor = (returnTo: string | null | undefined): string =>
  finishProfileHref(returnTo ?? null);

// ---------------------------------------------------------------- the mapping

export type GoingStateKind =
  | 'loading'
  | 'signed_out'
  | 'anonymous'
  | 'profile_unfinished'
  | 'can_tap'
  | 'going'
  | 'night_ended'
  | 'night_cancelled'
  | 'event_not_live'
  | 'rate_limited'
  | 'error';

/** What a tap does. */
export type GoingAction = 'go' | 'ungo' | 'sign_in' | 'none';

export type GoingControl = {
  enabled: boolean;
  label: string;
  /** Why it is disabled; null when enabled. Always shown on screen next to the button. */
  reason: string | null;
  /** aria-pressed: the viewer is going. */
  pressed: boolean;
  /** A save is in flight. */
  busy: boolean;
  action: GoingAction;
};

export type GoingLink = { to: string; label: string; external: boolean };

export type GoingView = {
  state: GoingStateKind;
  /** The viewer is going (optimistic while a save is in flight). */
  going: boolean;
  /** The line under the button; null = none. */
  words: string | null;
  control: GoingControl;
  link: GoingLink | null;
};

export type GoingFacts = {
  viewer: GoingViewer;
  night: GoingNightStatus;
  /** The viewer is going; null = not known yet (still loading). Ignored for signed-out/anonymous viewers. */
  going: boolean | null;
  /** A save is in flight. */
  pending?: boolean;
  /** The last save's error, until the next tap. */
  error?: GoingErrorCode | null;
  /**
   * going_count of the night; 0 shows the "be the first" invitation. null /
   * absent = NOT KNOWN (the read failed, is loading, or the database dropped the
   * id): no invitation, never a claimed count.
   */
  count?: number | null;
  /** Where the viewer is now, for the Finish screen to come back to. */
  returnTo?: string | null;
};

const control = (
  enabled: boolean,
  label: string,
  action: GoingAction,
  pressed: boolean,
  reason: string | null = null,
): GoingControl => ({ enabled, label, reason: enabled ? null : reason, pressed, busy: false, action });

const view = (state: GoingStateKind, going: boolean, words: string | null, c: GoingControl, link: GoingLink | null = null): GoingView => ({
  state,
  going,
  words,
  control: c,
  link,
});

/** A server refusal tells us more than the client knew: fold it into the facts first. */
const foldRefusal = (f: GoingFacts): { viewer: GoingViewer; night: GoingNightStatus } => {
  switch (f.error) {
    case 'not_signed_in':
      return { viewer: { kind: 'signed_out' }, night: f.night };
    case 'anonymous_session':
      return { viewer: { kind: 'anonymous' }, night: f.night };
    case 'profile_incomplete':
      return {
        viewer: f.viewer.kind === 'unfinished' ? f.viewer : { kind: 'unfinished', missing: [] },
        night: f.night,
      };
    case 'night_ended':
      return { viewer: f.viewer, night: 'ended' };
    case 'night_cancelled':
      return { viewer: f.viewer, night: 'cancelled' };
    case 'event_not_live':
      return { viewer: f.viewer, night: f.night === 'live' ? 'not_live' : f.night };
    default:
      return { viewer: f.viewer, night: f.night };
  }
};

/** The words for an error that is not a state of its own. */
const errorWords = (code: GoingErrorCode): string => {
  if (code === 'network') return GOING_COPY.network;
  if (code === 'not_found' || code === 'invalid_argument') return GOING_COPY.notFound;
  return GOING_COPY.error;
};

const goLabel = (going: boolean) => (going ? GOING_COPY.going : GOING_COPY.go);

/** THE mapping: facts -> state, words, control, link. Pure. */
export const goingStateFor = (facts: GoingFacts): GoingView => {
  const { viewer, night } = foldRefusal(facts);
  const signedIn = viewer.kind !== 'signed_out' && viewer.kind !== 'anonymous' && viewer.kind !== 'loading';
  const going = signedIn && facts.going === true;
  const pending = Boolean(facts.pending);

  const result = ((): GoingView => {
    // 1. The night itself.
    if (night === 'ended') {
      return going
        ? view('night_ended', true, GOING_COPY.endedGoing, control(true, GOING_COPY.going, 'ungo', true))
        : view('night_ended', false, GOING_COPY.ended,
          control(false, GOING_COPY.nightEnded, 'none', false, GOING_COPY.ended));
    }
    if (night === 'cancelled') {
      return going
        ? view('night_cancelled', true, GOING_COPY.cancelledGoing, control(true, GOING_COPY.going, 'ungo', true))
        : view('night_cancelled', false, GOING_COPY.cancelled,
          control(false, GOING_COPY.nightCancelled, 'none', false, GOING_COPY.cancelled));
    }
    if (night === 'not_live') {
      return going
        ? view('event_not_live', true, GOING_COPY.notLiveGoing, control(true, GOING_COPY.going, 'ungo', true))
        : view('event_not_live', false, GOING_COPY.notLive, control(false, GOING_COPY.go, 'none', false, GOING_COPY.notLive));
    }

    // 2. Who is looking.
    if (viewer.kind === 'loading') {
      return view('loading', false, null, control(false, GOING_COPY.go, 'none', false, GOING_COPY.loading));
    }
    if (viewer.kind === 'signed_out') {
      return view('signed_out', false, GOING_COPY.signedOut, control(true, GOING_COPY.signIn, 'sign_in', false));
    }
    if (viewer.kind === 'anonymous') {
      return view('anonymous', false, GOING_COPY.anonymous, control(true, GOING_COPY.signIn, 'sign_in', false));
    }
    if (facts.going === null && !pending) {
      return view('loading', false, null, control(false, GOING_COPY.go, 'none', false, GOING_COPY.loading));
    }

    // 3. A save error that is not a state of its own: the button stays usable.
    if (facts.error === 'rate_limited') {
      return view('rate_limited', going, GOING_COPY.rateLimited, control(true, goLabel(going), going ? 'ungo' : 'go', going));
    }
    if (facts.error && facts.error !== 'profile_incomplete') {
      return view('error', going, errorWords(facts.error), control(true, goLabel(going), going ? 'ungo' : 'go', going));
    }

    // 4. Going: always undoable, whatever the profile.
    if (going) {
      return view('going', true, GOING_COPY.goingUndoHint, control(true, GOING_COPY.going, 'ungo', true));
    }

    // 5. Not going: only a finished (or not-yet-known) profile may tap.
    if (viewer.kind === 'no_profile') {
      return view('profile_unfinished', false, GOING_COPY.noProfile,
        control(false, GOING_COPY.go, 'none', false, GOING_COPY.noProfile),
        { to: NO_PROFILE_CONTACT_URL, label: GOING_COPY.noProfileLink, external: true });
    }
    if (viewer.kind === 'unfinished') {
      const words = unfinishedText(viewer.missing);
      return view('profile_unfinished', false, words, control(false, GOING_COPY.go, 'none', false, words), {
        to: finishProfileLinkFor(facts.returnTo),
        label: GOING_COPY.finishLink,
        external: false,
      });
    }
    return view('can_tap', false, facts.count === 0 ? GOING_COPY.beFirst : null,
      control(true, GOING_COPY.go, 'go', false));
  })();

  if (!pending) return result;
  // In flight: the optimistic value shows, the button waits -- even when that
  // optimistic state is a disabled one (un-going on a cancelled night).
  return {
    ...result,
    control: { ...result.control, enabled: false, busy: true, reason: GOING_COPY.saving },
  };
};

/** The state a refusal code lands in, for a viewer who was otherwise free to tap. */
export const goingStateForRefusal = (code: GoingErrorCode, going = false): GoingStateKind =>
  goingStateFor({ viewer: { kind: 'finished' }, night: 'live', going, error: code, count: 1 }).state;
