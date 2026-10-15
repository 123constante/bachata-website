import { STRENGTH_STEPS, type DancerStrength, type MyDancerEdit, type StrengthStep } from './types';

/**
 * Every production data SHAPE from the plan's section 3 survey (read-only,
 * counts only, re-checked 2026-10-15: 152 live profiles, 15 with a dance role,
 * 97 with a photo, 91 with a city, 17 auth users) as a named fixture. Wave-2
 * screen tests are table-driven over DANCER_SHAPES: every screen x every shape.
 * No real person's data: names and ids are invented.
 */

export const CITY_LONDON = { id: 'c1000000-0000-4000-8000-000000000001', name: 'London' };
export const CITY_MADRID = { id: 'c1000000-0000-4000-8000-000000000002', name: 'Madrid' };
export const FAKE_CITIES: Record<string, string> = { [CITY_LONDON.id]: CITY_LONDON.name, [CITY_MADRID.id]: CITY_MADRID.name };

export const FAKE_USER_ID = 'a1000000-0000-4000-8000-000000000001';
export const FAKE_PROFILE_ID = 'b1000000-0000-4000-8000-000000000001';

const filled = (v: string | null | undefined) => typeof v === 'string' && v.trim() !== '';

/** profile_complete_v1, mirrored: first name, city, dance role, photo. */
export const isCompleteProfile = (p: Pick<MyDancerEdit, 'first_name' | 'based_city_id' | 'dance_role' | 'avatar_url'>): boolean =>
  filled(p.first_name) && filled(p.based_city_id) && filled(p.dance_role) && filled(p.avatar_url);

/**
 * _dancer_strength_v1, MIRRORED FOR THE FAKE ONLY. The server function is the one
 * place the formula lives; screens display `strength` and never compute it.
 * 10 base; +15 each for first name, city, role, photo (70 exactly with all
 * four); +10 started year, +10 styles, +10 bio with a social link, counted only
 * when all four exist. Invariant: pct >= 70 <=> complete (pinned in tests).
 */
export const fakeStrength = (p: MyDancerEdit): DancerStrength => {
  const has: Record<StrengthStep, boolean> = {
    first_name: filled(p.first_name),
    city: filled(p.based_city_id),
    role: filled(p.dance_role),
    photo: filled(p.avatar_url),
    started_year: typeof p.dance_started_year === 'number',
    styles: p.favorite_styles.length > 0,
    bio_social: filled(p.bio) && (filled(p.instagram) || filled(p.facebook) || filled(p.website_url)),
  };
  const required = has.first_name && has.city && has.role && has.photo;
  let pct = 10;
  for (const k of ['first_name', 'city', 'role', 'photo'] as const) if (has[k]) pct += 15;
  if (required) for (const k of ['started_year', 'styles', 'bio_social'] as const) if (has[k]) pct += 10;
  const missing = STRENGTH_STEPS.filter((k) => !has[k]);
  return { pct, next_step: missing[0] ?? null, missing };
};

/** Recompute the derived fields (complete, strength) the way the server would. */
export const withDerived = (p: MyDancerEdit): MyDancerEdit => {
  const base = { ...p, city_name: p.based_city_id ? FAKE_CITIES[p.based_city_id] ?? p.city_name : null };
  return { ...base, complete: isCompleteProfile(base), strength: fakeStrength(base) };
};

const blank: MyDancerEdit = {
  profile_id: FAKE_PROFILE_ID,
  user_id: FAKE_USER_ID,
  display_name: null,
  first_name: null,
  surname: null,
  hide_surname_publicly: false,
  based_city_id: null,
  city_name: null,
  dance_role: null,
  nationality: null,
  languages: [],
  bio: null,
  instagram: null,
  facebook: null,
  website_url: null,
  whatsapp: null,
  show_whatsapp_publicly: true,
  avatar_url: null,
  dance_started_year: null,
  favorite_styles: [],
  favorite_songs: [],
  achievements: [],
  other_roles: [],
  is_active: true,
  erase_requested_at: null,
  linked_from_admin: false,
  complete: false,
  strength: { pct: 10, next_step: 'first_name', missing: [...STRENGTH_STEPS] },
};

export const makeProfile = (over: Partial<MyDancerEdit> = {}): MyDancerEdit => withDerived({ ...blank, ...over });

const FOUR = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: 'https://img.example/ana.jpg' };

/**
 * A shape is either a profile the person sees (my_dancer_edit_v1 answers) or a
 * refusal (`error`): the RPC raises that code for this person.
 */
export type DancerShape = {
  label: string;
  signedIn: boolean;
  profile: MyDancerEdit | null;
  error?: 'no_profile' | 'not_signed_in';
};

export const DANCER_SHAPES = {
  emptyStub: { label: 'empty stub (sign-up with nothing filled)', signedIn: true, profile: makeProfile() },
  nameCityOnly: { label: 'name + city only', signedIn: true, profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id }) },
  fourFieldComplete: { label: 'four-field complete (70%)', signedIn: true, profile: makeProfile({ ...FOUR }) },
  /** Review B1: name, city and role but no photo = 55%, next step `photo` (the step the rebuild hinges on). */
  noPhoto: { label: 'name + city + role, no photo (55%)', signedIn: true, profile: makeProfile({ ...FOUR, avatar_url: null }) },
  completeAllExtras: {
    label: 'complete + all extras (100%)',
    signedIn: true,
    profile: makeProfile({
      ...FOUR,
      surname: 'Lopez',
      display_name: 'Ana L',
      nationality: 'ES',
      languages: ['English', 'Spanish'],
      bio: 'Social dancer, Thursdays in Soho.',
      instagram: 'ana.dances',
      dance_started_year: 2019,
      // Prod-shaped (read-only survey 2026-10-15): one preset spelling, one value off the preset list.
      favorite_styles: ['Bachata Sensual', 'Bachata Influence'],
      favorite_songs: ['Obsesion'],
      achievements: ['Workshop helper'],
    }),
  },
  /**
   * Real-data fix F1-F3 (read-only prod survey 2026-10-15, counts only: 68 of 167 have a link but no bio,
   * 4 store a website without a scheme, 166 have no WhatsApp number). 90%, next step bio_social.
   */
  linkNoBio: {
    label: 'links but no bio, website without https:// (90%)',
    signedIn: true,
    profile: makeProfile({
      ...FOUR,
      dance_started_year: 2018,
      favorite_styles: ['Bachata Sensual'],
      website_url: 'www.dance-example.co.uk',
      facebook: 'b',
      instagram: 'bachata.dance.example.london.socials',
      other_roles: ['organising'],
    }),
  },
  adminUnclaimedPhotoless: {
    label: 'admin-made, unclaimed, no photo',
    signedIn: true,
    profile: makeProfile({ first_name: 'Marco', based_city_id: CITY_LONDON.id, dance_role: 'Leader', other_roles: ['teaching'], linked_from_admin: false }),
  },
  adminSurnameInDisplayName: {
    label: 'admin-made with the surname inside display_name',
    signedIn: true,
    profile: makeProfile({ ...FOUR, first_name: 'Marco', surname: 'Rossi', display_name: 'Marco Rossi', other_roles: ['teaching'], linked_from_admin: true }),
  },
  hiddenSurname: { label: 'hidden surname', signedIn: true, profile: makeProfile({ ...FOUR, surname: 'Lopez', hide_surname_publicly: true }) },
  claimedAdmin: { label: 'claimed admin profile', signedIn: true, profile: makeProfile({ ...FOUR, other_roles: ['teaching'], linked_from_admin: true }) },
  claimedIncompleteAdmin: {
    label: 'claimed-but-incomplete admin profile',
    signedIn: true,
    profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, other_roles: ['teaching'], linked_from_admin: true }),
  },
  teacherWithWhatsapp: {
    label: 'teacher / DJ (WhatsApp rule applies)',
    signedIn: true,
    profile: makeProfile({ ...FOUR, other_roles: ['teaching', 'djing'], whatsapp: '+447700900123', show_whatsapp_publicly: true }),
  },
  organiserAlsoDancer: { label: 'organiser who is also a dancer', signedIn: true, profile: makeProfile({ ...FOUR, other_roles: ['organising'] }) },
  paused: { label: 'paused (hidden via my_profile_disable_v1)', signedIn: true, profile: makeProfile({ ...FOUR, is_active: false }) },
  eraseRequested: {
    label: 'erase requested (always null in 1a; shape kept for B2)',
    signedIn: true,
    profile: makeProfile({ ...FOUR, erase_requested_at: '2026-10-15T09:00:00Z' }),
  },
  namelessProfile: { label: 'nameless profile (noindex publicly)', signedIn: true, profile: makeProfile({ based_city_id: CITY_LONDON.id, avatar_url: 'https://img.example/x.jpg' }) },
  bioLegacyOver280: {
    label: 'teacher whose legacy description is over 280 (bio stays empty)',
    signedIn: true,
    profile: makeProfile({ ...FOUR, other_roles: ['teaching'], linked_from_admin: true }),
  },
  archivedRetiredStub: { label: 'archived retired stub (no live persona)', signedIn: true, profile: null, error: 'no_profile' },
  authUserNoPersona: { label: 'auth user with no persona', signedIn: true, profile: null, error: 'no_profile' },
  unconfirmedAccount: { label: 'unconfirmed account (no session)', signedIn: false, profile: null, error: 'not_signed_in' },
} satisfies Record<string, DancerShape>;

export type DancerShapeName = keyof typeof DANCER_SHAPES;
export const DANCER_SHAPE_NAMES = Object.keys(DANCER_SHAPES) as DancerShapeName[];
