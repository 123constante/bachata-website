// /join/a/:code -- the ambassador shared-link landing. ONE mapping from
// (who is looking) x (what the link lookup said) x (what the join tap said) to
// what the page shows. The page draws this; it decides nothing itself.
//
// RPC shapes (admin PR #1277, re-read on prod 2026-11-06):
//   get_ambassador_link_public_v1(p_code)  anon   -> {status:'ok', first_name, city_name, city_slug, is_active:true} | {status:'not_found'}
//   record_ambassador_link_join_v1(p_code) authed -> {status:'joined'|'already_joined', city_slug, city_name}
//     refusals are RAISEd: authentication_required (no user or an anonymous
//     session), link_not_found, own_link. It never sets the joiner's city.

export const LINK_CODE_MAX = 64;

export type LinkLookup =
  | { status: 'ok'; firstName: string | null; cityName: string; citySlug: string }
  | { status: 'not_found' };

export type JoinResult = { status: 'joined' | 'already_joined'; cityName: string; citySlug: string };

/** A raised refusal from record_ambassador_link_join_v1, or 'failed' for anything else. */
export type JoinRefusal = 'authentication_required' | 'link_not_found' | 'own_link' | 'failed';

export type Viewer = 'resolving' | 'signed-out' | 'anonymous' | 'signed-in';
export type LookupState = 'loading' | 'error' | LinkLookup;
export type JoinState = { kind: 'idle' } | { kind: 'pending' } | { kind: 'done'; result: JoinResult } | { kind: 'refused'; refusal: JoinRefusal };

export type LandingAction =
  | { kind: 'link'; label: string; href: string; primary: boolean; external?: boolean }
  | { kind: 'join'; label: string; primary: true; disabled: boolean; reason: string | null }
  | { kind: 'retry'; label: string; primary: boolean };

export type LandingKind = 'loading' | 'error' | 'not_found' | 'signed-out' | 'invite' | 'joined' | 'already_joined';

export interface LandingView {
  kind: LandingKind;
  heading: string;
  body: string;
  /** One plain sentence when the server said no (never a raw error code). */
  notice: string | null;
  /** The fixed city chip (never a picker). */
  city: string | null;
  actions: LandingAction[];
}

export const NEXT_STEP_HREF = '/app';

export const COPY = {
  loading: 'Opening your invite…',
  errorHeading: 'We could not open this link',
  errorBody: 'Check your connection, then try again.',
  notFoundHeading: 'This link does not work',
  notFoundBody: 'This link is switched off or wrong. Ask whoever sent it for a new one.',
  contact: 'Contact us',
  signIn: 'Sign in',
  signUp: 'Create account',
  signedOutBody: (city: string) => `Sign in or create a free account, then join ${city}. You come straight back here.`,
  anonymous: (city: string) => `You are browsing as a guest. Sign in or create an account to join ${city}.`,
  inviteBody: (city: string) => `Tap Join to accept the invite to ${city}.`,
  join: (city: string) => `Join ${city}`,
  joining: 'Joining…',
  joiningReason: 'Joining now. This takes a second.',
  resolvingReason: 'Checking whether you are signed in…',
  joinedHeading: (city: string) => `You joined ${city}`,
  alreadyHeading: (city: string) => `You already joined ${city}`,
  doneBody: 'Next step: open your organiser area to see what is on and add your own events.',
  next: 'Open your organiser area',
  ownLink: 'This is your own invite link. Share it with the people you want to bring in.',
  linkGone: 'This link was switched off a moment ago. Ask whoever sent it for a new one.',
  joinFailed: 'That did not go through. Check your connection, then tap Join again.',
} as const;

export const CONTACT_MESSAGE = 'Hi! The Bachata Calendar invite link I was sent does not work: ';

/** Heading for an ok link: the ambassador's first name when the server gave one. */
export function inviteHeading(firstName: string | null, cityName: string): string {
  const name = firstName?.trim();
  return name ? `${name} invited you to ${cityName}` : `You are invited to ${cityName}`;
}

/** Parse the public lookup; anything unexpected is treated as an error, not a guess. */
export function parseLookup(raw: unknown): LinkLookup {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.status === 'not_found') return { status: 'not_found' };
  if (r.status === 'ok' && typeof r.city_name === 'string' && typeof r.city_slug === 'string') {
    return { status: 'ok', firstName: typeof r.first_name === 'string' && r.first_name.trim() ? r.first_name : null, cityName: r.city_name, citySlug: r.city_slug };
  }
  throw new Error('ambassador_link_unexpected_shape');
}

export function parseJoin(raw: unknown): JoinResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if ((r.status === 'joined' || r.status === 'already_joined') && typeof r.city_name === 'string' && typeof r.city_slug === 'string') {
    return { status: r.status, cityName: r.city_name, citySlug: r.city_slug };
  }
  throw new Error('ambassador_join_unexpected_shape');
}

/** Map a thrown join error to a refusal; the server raises bare codes as the message. */
export function joinRefusal(err: unknown): JoinRefusal {
  const msg = String((err as { message?: unknown } | null)?.message ?? '');
  for (const code of ['authentication_required', 'link_not_found', 'own_link'] as const) if (msg.includes(code)) return code;
  return 'failed';
}

/** A code the server can never match (empty or too long) is not sent at all. */
export function isPlausibleCode(code: string): boolean {
  const c = code.trim();
  return c.length > 0 && c.length <= LINK_CODE_MAX;
}

export function landingView(args: { viewer: Viewer; lookup: LookupState; join: JoinState; returnTo: string; signInHref: (returnTo: string, mode: 'signin' | 'signup') => string; contactHref: string }): LandingView {
  const { viewer, lookup, join, returnTo, signInHref, contactHref } = args;
  const base = { notice: null as string | null, city: null as string | null };

  if (join.kind === 'done') {
    const { result } = join;
    return {
      ...base,
      kind: result.status,
      heading: result.status === 'joined' ? COPY.joinedHeading(result.cityName) : COPY.alreadyHeading(result.cityName),
      body: COPY.doneBody,
      city: result.cityName,
      actions: [{ kind: 'link', label: COPY.next, href: NEXT_STEP_HREF, primary: true }],
    };
  }
  if (lookup === 'loading') return { ...base, kind: 'loading', heading: COPY.loading, body: '', actions: [] };
  if (lookup === 'error') return { ...base, kind: 'error', heading: COPY.errorHeading, body: COPY.errorBody, actions: [{ kind: 'retry', label: 'Try again', primary: true }] };
  const contact: LandingAction = { kind: 'link', label: COPY.contact, href: contactHref, primary: false, external: true };
  if (lookup.status === 'not_found' || (join.kind === 'refused' && join.refusal === 'link_not_found')) {
    return {
      ...base,
      kind: 'not_found',
      heading: COPY.notFoundHeading,
      body: COPY.notFoundBody,
      notice: join.kind === 'refused' ? COPY.linkGone : null,
      actions: [contact],
    };
  }

  const city = lookup.cityName;
  const heading = inviteHeading(lookup.firstName, city);
  const refusedAuth = join.kind === 'refused' && join.refusal === 'authentication_required';
  if (viewer === 'signed-out' || viewer === 'anonymous' || refusedAuth) {
    return {
      ...base,
      kind: 'signed-out',
      heading,
      body: COPY.signedOutBody(city),
      notice: viewer === 'anonymous' || refusedAuth ? COPY.anonymous(city) : null,
      city,
      actions: [
        { kind: 'link', label: COPY.signUp, href: signInHref(returnTo, 'signup'), primary: true },
        { kind: 'link', label: COPY.signIn, href: signInHref(returnTo, 'signin'), primary: false },
      ],
    };
  }

  // signed-in (or still resolving): the Join button, disabled with a reason while it cannot work.
  const own = join.kind === 'refused' && join.refusal === 'own_link';
  const disabled = viewer === 'resolving' || join.kind === 'pending' || own;
  const reason = viewer === 'resolving' ? COPY.resolvingReason : join.kind === 'pending' ? COPY.joiningReason : own ? COPY.ownLink : null;
  return {
    ...base,
    kind: 'invite',
    heading,
    body: COPY.inviteBody(city),
    notice: join.kind === 'refused' && join.refusal === 'failed' ? COPY.joinFailed : null,
    city,
    actions: [{ kind: 'join', label: join.kind === 'pending' ? COPY.joining : COPY.join(city), primary: true, disabled, reason }],
  };
}
