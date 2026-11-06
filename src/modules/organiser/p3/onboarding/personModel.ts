// P3 W4b build 2, slice 1: the person screens 10-19 of the approved onboarding
// prototype (docs/design/onboarding-prototype.md, section 2). Screen 20 (personal email)
// was dropped by the owner on 2026-10-29: the path ends at About, or at years with no page. Pure: no React, no
// network. ONE place for the order, which steps the answers skip, the progress
// percentage, the words, why Continue is off, and the command each Continue sends
// (null = nothing changed, so nothing is sent).

import { listFromText } from '@/modules/organiser/home/onboarding/golive/roleQuestion';
import { LIST_ITEM_MAX, LIST_MAX_ITEMS, ROLE_FIELDS } from '@/modules/areas/shared/fieldRegistry';

export type PersonStep = 'name' | 'photo' | 'role' | 'nat' | 'langs' | 'teach' | 'levels' | 'styles' | 'years' | 'about' | 'dj' | 'djgenres';

/** Screen order (prototype ORDER, 10 to 19). Back walks the PATH, never this list. */
export const PERSON_ORDER: readonly PersonStep[] = ['name', 'photo', 'role', 'nat', 'langs', 'teach', 'levels', 'styles', 'years', 'about'];

/** Teach = No skips these (prototype section 2: "No skips 16 to 18"). */
export const TEACH_ONLY: readonly PersonStep[] = ['levels', 'styles', 'years'];

export type TeachAnswer = 'yes' | 'no' | null;

/**
 * The DJ steps (instagram-refusal r2, N5): reached ONLY from Review's DJ rows (dj_answer, dj_genres), never on a
 * new person's main path, so personPath and the bar are unchanged. DJ = No skips DJ_ONLY, as Teach = No skips
 * TEACH_ONLY. Entered at the genres row (dj claimed, no genres) the path is genres alone; the last step returns
 * to Review.
 */
export const DJ_ORDER: readonly PersonStep[] = ['dj', 'djgenres'];
export const DJ_ONLY: readonly PersonStep[] = ['djgenres'];
export const isDjStep = (s: PersonStep): boolean => DJ_ORDER.includes(s);
export const djPath = (dj: TeachAnswer, entry: PersonStep): PersonStep[] =>
  entry === 'djgenres' ? ['djgenres'] : DJ_ORDER.filter((s) => !(dj === 'no' && DJ_ONLY.includes(s)));

/**
 * The steps this person will see, in order. About is the organiser's About (plan A7), so it is only on
 * the path when there is a page to write it for. An unanswered teach keeps levels/styles/years on the
 * path (the bar must not jump forward before the answer).
 */
export const personPath = (teach: TeachAnswer, hasOrganiser: boolean): PersonStep[] =>
  PERSON_ORDER.filter((s) => !(teach === 'no' && TEACH_ONLY.includes(s)) && !(s === 'about' && !hasOrganiser));

/**
 * One missing teaching item (Levels, Styles or Years) tapped from Review: the path is that step alone, so
 * saving returns to Review at once. null for every other entry (the answer step, the first-time path).
 */
export const teachRowPath = (entry: PersonStep): PersonStep[] | null =>
  TEACH_ONLY.includes(entry) ? [entry] : null;

/**
 * Owner change 2: the bar shows a percentage. Step n of a path of N is round(n / N * 100). The path is
 * the person steps only in slice 1; slice 3 must pass the FULL onboarding path (contact ... person ...
 * Review) or the bar reads 100% with Review still ahead.
 */
export const progressPercent = (step: PersonStep, path: readonly PersonStep[]): number => {
  const i = path.indexOf(step);
  if (i < 0 || path.length === 0) return 0;
  return Math.round(((i + 1) / path.length) * 100);
};

export const prevStep = (step: PersonStep, path: readonly PersonStep[]): PersonStep | null => {
  const i = path.indexOf(step);
  return i > 0 ? path[i - 1] : null;
};

export const nextStep = (step: PersonStep, path: readonly PersonStep[]): PersonStep | null => {
  const i = path.indexOf(step);
  return i >= 0 && i < path.length - 1 ? path[i + 1] : null;
};

/** Stored dance roles (dancer_profiles.dance_role). "Both" is stored as `Lead and Follow`. */
export const ROLE_OPTIONS = [
  { value: 'Leader', label: 'Leader' },
  { value: 'Follower', label: 'Follower' },
  { value: 'Lead and Follow', label: 'Both' },
] as const;

/** teacher_role_details.levels_taught CHECK (S1, D1). */
export const LEVELS = [
  { value: 'Beginner', help: 'First steps and basics' },
  { value: 'Improver', help: 'Knows the basics' },
  { value: 'Intermediate', help: 'Adding style' },
  { value: 'Advanced', help: 'Dances with confidence' },
] as const;

/** Nationality: the on-screen six with no query (prototype NAT_FEW). The home nations are found by search or in the sheet. */
export const NAT_FEW: readonly string[] = ['GB', 'ES', 'DO', 'IT', 'PL', 'BR'];

/** Nationality: the sheet's first section (prototype POPULAR). Codes as the dancer editor stores them (alpha-2, or GB-ENG style). */
export const POPULAR_NATIONS: readonly (readonly [string, string])[] = [
  ['GB', 'United Kingdom'], ['GB-ENG', 'England'], ['GB-SCT', 'Scotland'], ['GB-WLS', 'Wales'], ['GB-NIR', 'Northern Ireland'],
  ['ES', 'Spain'], ['DO', 'Dominican Republic'], ['IT', 'Italy'], ['PL', 'Poland'], ['BR', 'Brazil'], ['PT', 'Portugal'],
  ['FR', 'France'], ['RO', 'Romania'], ['IE', 'Ireland'], ['CO', 'Colombia'], ['CU', 'Cuba'],
];

export const LANG_FEW: readonly string[] = ['English', 'Spanish', 'Portuguese', 'Italian', 'Polish', 'French'];
export const LANG_ALL: readonly string[] = [...LANG_FEW, 'Romanian', 'German', 'Lithuanian', 'Greek', 'Hungarian', 'Russian', 'Ukrainian', 'Arabic', 'Turkish', 'Dutch', 'Hindi', 'Urdu', 'Punjabi', 'Bulgarian', 'Czech', 'Slovak', 'Swedish', 'Danish', 'Norwegian', 'Finnish', 'Japanese', 'Mandarin Chinese', 'Cantonese', 'Korean', 'Tagalog', 'Swahili', 'Yoruba', 'Hebrew', 'Persian', 'Welsh', 'Irish', 'British Sign Language'];

export const STY_FEW: readonly string[] = ['Bachata sensual', 'Dominican bachata', 'Traditional', 'Moderna', 'Fusion', 'Salsa'];
export const STY_ALL: readonly string[] = [...STY_FEW, 'Urban', 'Kizomba', 'Zouk', 'Footwork', 'Musicality', 'Body movement', 'Ladies styling', 'Men styling'];

export const YEARS_MAX = 60;
export const ABOUT_MAX = 500;
/** On-screen chips: six, popular first; typing filters to six matches. */
export const CHIPS_ON_SCREEN = 6;

const norm = (s: string) => s.trim().toLowerCase();

/** Six on screen: no query = the popular six; a query = the first six matches (starts-with first). */
export function sixFor<T>(all: readonly T[], few: readonly T[], query: string, label: (t: T) => string): T[] {
  const q = norm(query);
  if (!q) return few.slice(0, CHIPS_ON_SCREEN);
  const starts = all.filter((t) => norm(label(t)).startsWith(q));
  const has = all.filter((t) => !norm(label(t)).startsWith(q) && norm(label(t)).includes(q));
  return [...starts, ...has].slice(0, CHIPS_ON_SCREEN);
}

/** Add or remove one value (case-insensitive), keeping order. */
export const toggleIn = (list: readonly string[], v: string): string[] =>
  list.some((x) => norm(x) === norm(v)) ? list.filter((x) => norm(x) !== norm(v)) : [...list, v];

export const sameList = (a: readonly string[], b: readonly string[]): boolean => {
  if (a.length !== b.length) return false;
  const bs = new Set(b.map(norm));
  return a.every((x) => bs.has(norm(x)));
};

/** "12" -> 12; '' or anything outside 0..60 or not whole -> null. */
export const parseYears = (raw: string): number | null => {
  const t = raw.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= YEARS_MAX ? n : null;
};

/** Every answer on the person screens, as the screens hold it. */
export type PersonDraft = {
  first_name: string;
  avatar_url: string;
  dance_role: string;
  /** Code as stored (ES, GB-ENG), or a legacy typed value. */
  nationality: string;
  languages: string[];
  teach: TeachAnswer;
  levels: string[];
  styles: string[];
  years: string;
  about: string;
  /** Do you DJ? (account_role_intent 'dj', as teach is 'teacher'). */
  dj: TeachAnswer;
  /** dj_role_details.genres as typed: a comma list. */
  genres: string;
};

export const EMPTY_DRAFT: PersonDraft = { first_name: '', avatar_url: '', dance_role: '', nationality: '', languages: [], teach: null, levels: [], styles: [], years: '', about: '', dj: null, genres: '' };

/** The genres box -> the list save_my_role_v1 stores (trimmed, no blanks, no repeats). */
export const genresFrom = (raw: string): string[] => listFromText(raw);
const GENRES_EMPTY = 'Type at least one to continue.';
const GENRES_MANY = `Up to ${LIST_MAX_ITEMS}, separated by commas.`;
const GENRES_LONG = `Keep each one to ${LIST_ITEM_MAX} characters or fewer.`;
/** save_my_role_v1's list limits (invalid_list): at most 20 items, each at most 80 characters. */
export const genresReason = (raw: string): string | null => {
  const list = genresFrom(raw);
  if (list.length === 0) return GENRES_EMPTY;
  if (list.length > LIST_MAX_ITEMS) return GENRES_MANY;
  return list.some((g) => g.length > LIST_ITEM_MAX) ? GENRES_LONG : null;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []);

/**
 * What the server holds, in the draft's shape: my_dancer_edit_v1 (dancer), my_role_intent_v1 (teach
 * answer: Yes = role claimed and not declined, No = declined, else unanswered), my_role_details_v1
 * ('teacher'), and the organiser's bio. Missing reads are empty, never invented.
 */
export function heldFrom(reads: {
  dancer: Record<string, unknown> | null;
  intent: { roles: readonly string[]; declined: readonly string[] } | null;
  teacher: Record<string, unknown> | null;
  bio: string | null;
  /** my_role_details_v1('dj') details; only the DJ steps read it. */
  dj?: Record<string, unknown> | null;
}): PersonDraft {
  const d = reads.dancer ?? {};
  const teach: TeachAnswer = !reads.intent ? null : reads.intent.declined.includes('teacher') ? 'no' : reads.intent.roles.includes('teacher') ? 'yes' : null;
  const dj: TeachAnswer = !reads.intent ? null : reads.intent.declined.includes('dj') ? 'no' : reads.intent.roles.includes('dj') ? 'yes' : null;
  const t = reads.teacher ?? {};
  const years = typeof t.years_teaching === 'number' && Number.isInteger(t.years_teaching) ? String(t.years_teaching) : '';
  return {
    first_name: str(d.first_name),
    avatar_url: str(d.avatar_url),
    dance_role: ROLE_OPTIONS.some((r) => r.value === d.dance_role) ? str(d.dance_role) : '',
    nationality: str(d.nationality),
    languages: strList(d.languages),
    teach,
    // Prod my_role_details_v1 does not return levels_taught yet (queued admin item), so this is [] today.
    levels: strList(t.levels_taught).filter((l) => LEVELS.some((x) => x.value === l)),
    styles: strList(t.teaching_styles),
    years,
    about: reads.bio ?? '',
    dj,
    genres: strList(reads.dj?.genres).join(', '),
  };
}

export type StepCopy = { title: string; helper: string | null; reason: string | null; optional: boolean };

export const STEP_COPY: Record<PersonStep, StepCopy> = {
  name: { title: 'Your first name', helper: 'Goes on your dancer card.', reason: 'Type your first name to continue.', optional: false },
  photo: { title: 'Your photo', helper: 'Add a photo to continue. Dancers like to see who they\u2019re meeting. A clear face shot works best.', reason: 'Add a photo to continue.', optional: false },
  role: { title: 'How do you dance?', helper: null, reason: 'Pick one to continue.', optional: false },
  nat: { title: 'Nationality', helper: null, reason: 'Pick your nationality to continue.', optional: false },
  langs: { title: 'Languages you speak', helper: null, reason: null, optional: true },
  teach: { title: 'Do you teach?', helper: 'This shows on your teacher page.', reason: 'Answer to continue.', optional: false },
  levels: { title: 'Which levels?', helper: 'Tick all that apply.', reason: 'Pick at least one level to continue.', optional: false },
  styles: { title: 'Styles you teach', helper: null, reason: 'Pick at least one style to continue.', optional: false },
  years: { title: 'Years teaching', helper: '0 is fine.', reason: 'Type a number from 0 to 60 to continue.', optional: false },
  about: { title: 'About', helper: 'A sentence or two for the top of your page.', reason: null, optional: true },
  dj: { title: 'Do you DJ?', helper: 'This shows on your DJ page.', reason: 'Answer to continue.', optional: false },
  djgenres: { title: 'Music you play', helper: ROLE_FIELDS.dj.find((f) => f.key === 'genres')?.help ?? null, reason: GENRES_EMPTY, optional: false },
};

export const SAVE_FAILED = 'Couldn\u2019t save. Check your connection and try again.';
export const READ_FAILED = 'We couldn\u2019t load your details. Try again.';
export const UPLOAD_FAILED = 'That photo did not upload. Try again or pick another.';
/** The dancer area gate (app_feature_flags.dancer_area_open) is shut: every dancer read and write raises area_closed. */
export const AREA_CLOSED = 'Your dancer details are closed for now, so we can\u2019t load or save them. Try again later.';

const isAreaClosed = (e: unknown) => e instanceof Error && /\barea_closed\b/.test(e.message);
export const readFailCopy = (errors: readonly unknown[]): string => (errors.some(isAreaClosed) ? AREA_CLOSED : READ_FAILED);
export const saveFailCopy = (e: unknown): string => (isAreaClosed(e) ? AREA_CLOSED : SAVE_FAILED);

/**
 * An account with no dancer row: my_dancer_edit_v1 (and save_my_dancer_profile_v2) raise `no_profile`
 * (prod 2026-10-30: 3 of 43 accounts, 2 of them admins; new sign-ups get a stub row from the auth.users
 * trigger). The site has no way to create the row (auto-create is a queued admin item), so Retry can
 * never succeed: the screen says so and offers the team's contact link instead.
 */
export const isNoDancer = (e: unknown) => e instanceof Error && /(^|[^a-z_])no_profile([^a-z_]|$)/.test(e.message);
/** What a failed person read shows: the no-dancer screen (no Retry), or the read error (with Retry). */
export const personReadFail = (errors: readonly unknown[]): 'no_dancer' | 'failed' => (errors.some(isNoDancer) ? 'no_dancer' : 'failed');

/** Why Continue is off on this step, or null when it is on. Never a disabled control without a reason. */
export function blockedReason(step: PersonStep, d: PersonDraft): string | null {
  const r = STEP_COPY[step].reason;
  switch (step) {
    case 'name': return d.first_name.trim() ? null : r;
    case 'photo': return d.avatar_url.trim() ? null : r;
    case 'role': return d.dance_role ? null : r;
    case 'nat': return d.nationality.trim() ? null : r;
    case 'teach': return d.teach ? null : r;
    case 'levels': return d.levels.length > 0 ? null : r;
    case 'styles': return d.styles.length > 0 ? null : r;
    case 'years': return parseYears(d.years) === null ? r : null;
    case 'dj': return d.dj ? null : r;
    case 'djgenres': return genresReason(d.genres);
    default: return null;
  }
}

/** What one Continue sends. Each kind is one existing RPC (personApi.ts). */
export type PersonCommand =
  | { kind: 'dancer'; patch: Record<string, unknown> }
  | { kind: 'teach'; yes: boolean }
  | { kind: 'teacher'; patch: Record<string, unknown> }
  | { kind: 'about'; bio: string }
  | { kind: 'dj'; yes: boolean }
  | { kind: 'djrole'; patch: Record<string, unknown> };

/** The command for Continue on this step, diff-first against what the server holds: an untouched answer sends nothing (null). */
export function commandFor(step: PersonStep, d: PersonDraft, held: PersonDraft): PersonCommand | null {
  switch (step) {
    case 'name': {
      const v = d.first_name.trim();
      return v && v !== held.first_name.trim() ? { kind: 'dancer', patch: { first_name: v } } : null;
    }
    case 'photo':
      return d.avatar_url && d.avatar_url !== held.avatar_url ? { kind: 'dancer', patch: { avatar_url: d.avatar_url } } : null;
    case 'role':
      return d.dance_role && d.dance_role !== held.dance_role ? { kind: 'dancer', patch: { dance_role: d.dance_role } } : null;
    case 'nat': {
      const v = d.nationality.trim();
      return v && v.toUpperCase() !== held.nationality.trim().toUpperCase() ? { kind: 'dancer', patch: { nationality: v } } : null;
    }
    case 'langs':
      return sameList(d.languages, held.languages) ? null : { kind: 'dancer', patch: { languages: d.languages } };
    case 'teach':
      return d.teach && d.teach !== held.teach ? { kind: 'teach', yes: d.teach === 'yes' } : null;
    case 'levels':
      return d.levels.length && !sameList(d.levels, held.levels) ? { kind: 'teacher', patch: { levels_taught: LEVELS.map((l) => l.value).filter((l) => d.levels.includes(l)) } } : null;
    case 'styles':
      return d.styles.length && !sameList(d.styles, held.styles) ? { kind: 'teacher', patch: { teaching_styles: d.styles } } : null;
    case 'years': {
      const n = parseYears(d.years);
      return n !== null && String(n) !== held.years ? { kind: 'teacher', patch: { years_teaching: n } } : null;
    }
    case 'about': {
      const v = d.about.trim();
      return v && v !== held.about.trim() ? { kind: 'about', bio: v } : null;
    }
    case 'dj':
      return d.dj && d.dj !== held.dj ? { kind: 'dj', yes: d.dj === 'yes' } : null;
    case 'djgenres': {
      const list = genresFrom(d.genres);
      return list.length && !sameList(list, genresFrom(held.genres)) ? { kind: 'djrole', patch: { genres: list } } : null;
    }
  }
}

/**
 * About's starter (plan A7: never invents a fact; omits what is missing). '' when there is nothing
 * true to say, and the screen then hides the starter link.
 */
export function starterSentence(o: { name: string; category: string | null; city: string | null; styles: readonly string[] }): string {
  const name = o.name.trim();
  if (!name) return '';
  const cat = (o.category ?? '').trim().toLowerCase();
  const city = (o.city ?? '').trim();
  const parts: string[] = [];
  if (cat && city) parts.push(`${name} is a ${cat} in ${city}.`);
  else if (cat) parts.push(`${name} is a ${cat}.`);
  else if (city) parts.push(`${name} is based in ${city}.`);
  if (o.styles.length > 0) parts.push(`Classes in ${o.styles.slice(0, 3).join(', ')}.`);
  return parts.join(' ');
}

/** What the server holds after this step's command landed: the next Continue on it sends nothing. */
export function heldAfter(step: PersonStep, held: PersonDraft, d: PersonDraft): PersonDraft {
  switch (step) {
    case 'name': return { ...held, first_name: d.first_name.trim() };
    case 'photo': return { ...held, avatar_url: d.avatar_url };
    case 'role': return { ...held, dance_role: d.dance_role };
    case 'nat': return { ...held, nationality: d.nationality.trim() };
    case 'langs': return { ...held, languages: [...d.languages] };
    case 'teach': return { ...held, teach: d.teach };
    case 'levels': return { ...held, levels: [...d.levels] };
    case 'styles': return { ...held, styles: [...d.styles] };
    case 'years': { const n = parseYears(d.years); return n === null ? held : { ...held, years: String(n) }; }
    case 'about': return { ...held, about: d.about.trim() };
    case 'dj': return { ...held, dj: d.dj };
    case 'djgenres': return { ...held, genres: genresFrom(d.genres).join(', ') };
  }
}
