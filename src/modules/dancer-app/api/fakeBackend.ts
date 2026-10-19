import { DancerApiError } from './errors';
import { DANCER_SHAPES, FAKE_CITIES, withDerived, type DancerShapeName } from './fixtures';
import type { DancerBackend } from './rpc';
import { DANCE_ROLES, FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, SAVE_KEYS, type DancerDelta, type FeatureKey, type FeedbackKind, type DancerErrorCode, type DancerGate, type MyDancerEdit, type PublicDancerExtras } from './types';
import { sameValue } from './delta';
import { STATS_SHAPES, type StatsShapeName } from './statsFixtures';

/**
 * In-memory stand-in for the four dancer-area RPCs, for tests only (never
 * imported by app code). It mirrors the server contract in INTERFACE sections 1
 * and 3 closely enough that a wave-2 test passing against it means the screen
 * handles what the server will say:
 *
 * - gate: closed + unlisted -> allowed false; listed or open -> allowed true;
 *   member reads/writes refuse `area_closed` first when not allowed.
 * - save_my_dancer_profile_v2 is DIFF-FIRST: unknown key -> `unknown_key`; a
 *   WhatsApp key from a person with no other profile type -> `whatsapp_not_allowed`
 *   (mere presence, before the diff, as the DB does); an
 *   empty delta returns the current shape with NO write (writes stays 0, the
 *   profile object is not replaced); only a non-empty delta is rate-checked,
 *   validated (same codes, same order) and written.
 *
 * Inspect `calls` (every wrapper call, in order) and `writes` (saves that
 * changed something) in assertions.
 */
export type FakeBackendOptions = {
  /** Default: allowed (listed, area closed). */
  gate?: DancerGate;
  /** Start from a named production shape (api/fixtures.ts). Default: fourFieldComplete. */
  shape?: DancerShapeName;
  /** Or give the profile directly (null = no persona: `no_profile`). Wins over `shape`. */
  profile?: MyDancerEdit | null;
  signedIn?: boolean;
  /** Saves allowed per window before `rate_limited` (server: 60 an hour). */
  rateLimit?: number;
  /** Public extras by profile id (default: derived from the current profile when live). */
  publicExtras?: Record<string, PublicDancerExtras>;
  /** Named stats/views shape (api/statsFixtures.ts). Default: zero. */
  statsShape?: StatsShapeName;
  /** Features already registered (my_feature_interest_v1). Default: none. */
  interest?: FeatureKey[];
  /** Feedback messages allowed per day before `rate_limited` (server: 5). */
  feedbackLimit?: number;
};

export type FakeCall = {
  fn:
    | 'fetchGate'
    | 'fetchMyDancerEdit'
    | 'saveMyDancerProfile'
    | 'fetchPublicExtras'
    | 'fetchMyStats'
    | 'fetchMyViews'
    | 'submitFeedback'
    | 'registerFeatureInterest'
    | 'fetchMyFeatureInterest';
  args?: unknown;
};

export type FakeDancerBackend = DancerBackend & {
  calls: FakeCall[];
  /** Saves that changed something (an untouched save never counts). */
  readonly writes: number;
  /** The profile as the server now holds it. */
  current(): MyDancerEdit | null;
  setGate(gate: DancerGate): void;
  /** The next call (any wrapper) fails with this code, once. */
  failNextWith(code: DancerErrorCode): void;
  /** Feedback messages stored so far. */
  readonly feedback: Array<{ body: string; kind: FeedbackKind; page: string | null }>;
  /** Features registered so far. */
  readonly interest: FeatureKey[];
};

const HANDLE_RE = /^[A-Za-z0-9._]{1,50}$/;
const BIO_LINK_RE = /https?:\/\/|www\.|\.[a-z]{2,}\//i;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** The validation codes (with the DB's DETAIL where it sends one), in the server's order. null = valid. */
const validate = (delta: DancerDelta): DancerErrorCode | [DancerErrorCode, string] | null => {
  if ('display_name' in delta && !isEmpty(delta.display_name)) {
    const v = String(delta.display_name).trim();
    if (v.length < 1 || v.length > 40 || /http|:\/\/|@/i.test(v) || CONTROL_RE.test(v)) return 'invalid_display_name';
  }
  if ('first_name' in delta && isEmpty(delta.first_name)) return 'first_name_required';
  if ('based_city_id' in delta && (isEmpty(delta.based_city_id) || !FAKE_CITIES[String(delta.based_city_id)])) return 'city_required';
  if ('avatar_url' in delta && isEmpty(delta.avatar_url)) return 'photo_required';
  if ('bio' in delta && !isEmpty(delta.bio)) {
    const v = String(delta.bio);
    if (v.length > 280) return 'bio_too_long';
    if (BIO_LINK_RE.test(v)) return 'bio_has_link';
  }
  for (const k of ['instagram', 'facebook'] as const) {
    if (k in delta && !isEmpty(delta[k]) && !HANDLE_RE.test(String(delta[k]).replace(/^@/, ''))) return ['invalid_handle', k];
  }
  if ('website_url' in delta && !isEmpty(delta.website_url) && !/^https?:\/\/\S+$/i.test(String(delta.website_url))) return ['invalid_url', 'website_url'];
  if ('dance_started_year' in delta && delta.dance_started_year !== null && delta.dance_started_year !== undefined) {
    const y = delta.dance_started_year;
    if (!Number.isInteger(y) || y < 1950 || y > new Date().getFullYear()) return 'invalid_year';
  }
  if ('dance_role' in delta && !isEmpty(delta.dance_role) && !(DANCE_ROLES as readonly string[]).includes(String(delta.dance_role))) return 'invalid_role';
  return null;
};

const applyDelta = (current: MyDancerEdit, delta: DancerDelta): MyDancerEdit => {
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(delta)) {
    const before = (current as Record<string, unknown>)[k];
    if (Array.isArray(before)) next[k] = Array.isArray(v) ? v : [];
    else if (typeof v === 'string') next[k] = v.trim() === '' ? null : v.trim();
    else next[k] = v ?? null;
  }
  return withDerived(next as MyDancerEdit);
};

export const createFakeBackend = (opts: FakeBackendOptions = {}): FakeDancerBackend => {
  const shape = DANCER_SHAPES[opts.shape ?? 'fourFieldComplete'];
  let gate: DancerGate = opts.gate ?? { open: false, allowed: true };
  let profile: MyDancerEdit | null = opts.profile !== undefined ? opts.profile : shape.profile;
  const signedIn = opts.signedIn ?? shape.signedIn;
  const rateLimit = opts.rateLimit ?? 60;
  let saves = 0;
  let writes = 0;
  let failNext: DancerErrorCode | null = null;
  const calls: FakeCall[] = [];
  const statsFixture = STATS_SHAPES[opts.statsShape ?? 'zero'];
  const feedback: Array<{ body: string; kind: FeedbackKind; page: string | null }> = [];
  const interest: FeatureKey[] = [...(opts.interest ?? [])];
  const feedbackLimit = opts.feedbackLimit ?? 5;

  const consumeFailure = () => {
    if (failNext) {
      const code = failNext;
      failNext = null;
      throw new DancerApiError(code, code);
    }
  };
  /** Every member RPC: gate first, then the session, then the persona. */
  const requireMember = (): MyDancerEdit => {
    if (!(signedIn ? gate.allowed : gate.open)) throw new DancerApiError('area_closed', 'area_closed');
    if (!signedIn) throw new DancerApiError('not_signed_in', 'not_signed_in');
    if (!profile) throw new DancerApiError('no_profile', 'no_profile');
    return profile;
  };

  return {
    calls,
    get writes() {
      return writes;
    },
    current: () => profile,
    feedback,
    interest,
    setGate: (g) => {
      gate = g;
    },
    failNextWith: (code) => {
      failNext = code;
    },

    async fetchGate() {
      calls.push({ fn: 'fetchGate' });
      consumeFailure();
      return { open: gate.open, allowed: signedIn ? gate.allowed : gate.open };
    },

    async fetchMyDancerEdit() {
      calls.push({ fn: 'fetchMyDancerEdit' });
      consumeFailure();
      return requireMember();
    },

    async saveMyDancerProfile(delta) {
      calls.push({ fn: 'saveMyDancerProfile', args: delta });
      consumeFailure();
      const current = requireMember();
      for (const k of Object.keys(delta)) {
        if (!(SAVE_KEYS as readonly string[]).includes(k)) throw new DancerApiError('unknown_key', 'unknown_key', k);
      }
      // Like the DB: the mere PRESENCE of a WhatsApp key from a person with no
      // other profile type is refused, even an unchanged one (before the diff).
      if (('whatsapp' in delta || 'show_whatsapp_publicly' in delta) && current.other_roles.length === 0) {
        throw new DancerApiError('whatsapp_not_allowed', 'whatsapp_not_allowed');
      }
      const changed = Object.fromEntries(
        Object.entries(delta).filter(([k, v]) => !sameValue(current[k as keyof DancerDelta], v as DancerDelta[keyof DancerDelta])),
      ) as DancerDelta;
      // Diff-first: nothing changed -> no rate check, no write, same object back.
      if (Object.keys(changed).length === 0) return current;
      if (saves >= rateLimit) throw new DancerApiError('rate_limited', 'rate_limited');
      saves += 1;
      const invalid = validate(changed);
      if (invalid) {
        const [code, detail] = Array.isArray(invalid) ? invalid : [invalid, null];
        throw new DancerApiError(code, code, detail);
      }
      profile = applyDelta(current, changed);
      writes += 1;
      return profile;
    },

    async fetchPublicExtras(profileId) {
      calls.push({ fn: 'fetchPublicExtras', args: profileId });
      consumeFailure();
      if (opts.publicExtras && profileId in opts.publicExtras) return opts.publicExtras[profileId];
      if (!profile || profile.profile_id !== profileId || !profile.is_active) return null;
      const whatsapp = profile.show_whatsapp_publicly && profile.other_roles.length > 0 ? profile.whatsapp : null;
      return { bio: profile.bio, languages: profile.languages, whatsapp };
    },

    async fetchMyStats() {
      calls.push({ fn: 'fetchMyStats' });
      consumeFailure();
      requireMember();
      if ('error' in statsFixture) throw new DancerApiError(statsFixture.error, statsFixture.error);
      return statsFixture.stats;
    },

    async fetchMyViews() {
      calls.push({ fn: 'fetchMyViews' });
      consumeFailure();
      requireMember();
      if ('error' in statsFixture) throw new DancerApiError(statsFixture.error, statsFixture.error);
      return statsFixture.views;
    },

    async submitFeedback(body, kind, page) {
      calls.push({ fn: 'submitFeedback', args: { body, kind, page } });
      consumeFailure();
      if (!signedIn ? true : !gate.allowed) throw new DancerApiError(signedIn ? 'area_closed' : 'not_signed_in', 'area_closed');
      const text = body.trim();
      if (text.length < 1 || text.length > FEEDBACK_MAX_LENGTH) throw new DancerApiError('invalid_body', 'invalid_body');
      if (!(FEEDBACK_KINDS as readonly string[]).includes(kind)) throw new DancerApiError('invalid_kind', 'invalid_kind');
      if (page !== null && page.length > 200) throw new DancerApiError('invalid_page', 'invalid_page');
      if (feedback.length >= feedbackLimit) throw new DancerApiError('rate_limited', 'rate_limited');
      feedback.push({ body: text, kind, page });
      return { id: `f-${feedback.length}`, kind, created_at: '2026-10-17T12:00:00Z' };
    },

    async registerFeatureInterest(feature) {
      calls.push({ fn: 'registerFeatureInterest', args: feature });
      consumeFailure();
      requireMember();
      if (interest.includes(feature)) return { alreadyRegistered: true };
      interest.push(feature);
      return { alreadyRegistered: false };
    },

    async fetchMyFeatureInterest() {
      calls.push({ fn: 'fetchMyFeatureInterest' });
      consumeFailure();
      requireMember();
      return { registered: [...interest] };
    },
  };
};
