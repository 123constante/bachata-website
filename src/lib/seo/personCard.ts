/**
 * People arc S5: the ONE rule for a person's link-preview card per role (title, description,
 * image choice, path, og:type). buildSeoForRoute's teacher/dj/dancer specs AND middleware.ts's
 * bot card for /teachers both read it, so the SSR route and the edge middleware cannot drift
 * (before S5 the middleware title was the bare name, its og:type and description differed, and
 * the SSR city was always "London"). Pure, no imports: middleware.ts bundles it as is.
 *
 * The city is the person's own based city; with none, the card names no city rather than
 * claiming London (60 of 172 live profiles have none, survey 2026-10-24).
 */
export type PersonCardRole = 'teacher' | 'dj' | 'dancer';

export interface PersonCardInput {
  name?: string | null;
  slug?: string | null;
  city?: string | null;
}

const ROLE_WORD: Record<PersonCardRole, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };
const ROLE_BASE: Record<PersonCardRole, string> = { teacher: '/teachers', dj: '/djs', dancer: '/dancers' };
const FALLBACK_SUBJECT: Record<PersonCardRole, string> = { teacher: 'This teacher', dj: 'This DJ', dancer: 'This dancer' };

const clean = (s: string | null | undefined): string | null => {
  const v = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
  return v || null;
};

/** "Morcilla - Bachata DJ, Madrid"; no city -> "Morcilla - Bachata DJ". The site suffix is added by the emitter. */
export function personCardTitle(role: PersonCardRole, input: PersonCardInput): string {
  const city = clean(input.city);
  return `${clean(input.name) ?? ROLE_WORD[role]} - Bachata ${ROLE_WORD[role]}${city ? `, ${city}` : ''}`;
}

export function personCardDescription(role: PersonCardRole, input: PersonCardInput): string {
  const who = clean(input.name) ?? FALLBACK_SUBJECT[role];
  const city = clean(input.city);
  const where = city ? ` in ${city}` : '';
  switch (role) {
    case 'teacher':
      return `${who} teaches bachata${where}. Classes, schedule and styles.`;
    case 'dj':
      return `${who} plays bachata${where}. Upcoming sets and where to hear them.`;
    case 'dancer':
      return `${who} - bachata dancer${where}, on Bachata Calendar.`;
  }
}

export const personCardPath = (role: PersonCardRole, slug: string | null | undefined): string => `${ROLE_BASE[role]}/${slug ?? ''}`;

/** Every person card is a profile card (unfurlers branch on og:type=profile for the layout). */
export const PERSON_CARD_OG_TYPE = 'profile' as const;

/**
 * The raw photo a role's card shows: the role's own photo, then the person's avatar, then null
 * (the emitter's default card). No role has its own photo column today (get_public_dj_v1's
 * photo_url IS dancer_profiles.avatar_url), so a role photo is passed only once one exists.
 */
export function personCardPhoto(rolePhoto: unknown, avatar: unknown): string | null {
  for (const p of [rolePhoto, avatar]) {
    // An array (photo_url is text[] on some RPCs): its first non-blank entry.
    const v = Array.isArray(p) ? p.find((x) => typeof x === 'string' && x.trim()) : p;
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}
