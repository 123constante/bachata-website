// P3 W4b build 2, slice 1: the person screens 10-20 of the approved onboarding
// prototype (docs/design/onboarding-prototype.md, section 2). Pure: no React, no
// network. ONE place for the order, which steps the answers skip, the progress
// percentage, the words, why Continue is off, and the command each Continue sends
// (null = nothing changed, so nothing is sent).

export type PersonStep = 'name' | 'photo' | 'role' | 'nat' | 'langs' | 'teach' | 'levels' | 'styles' | 'years' | 'about' | 'email';

/** Screen order (prototype ORDER, 10 to 20). Back walks the PATH, never this list. */
export const PERSON_ORDER: readonly PersonStep[] = ['name', 'photo', 'role', 'nat', 'langs', 'teach', 'levels', 'styles', 'years', 'about', 'email'];

/** Teach = No skips these (prototype section 2: "No skips 16 to 18"). */
export const TEACH_ONLY: readonly PersonStep[] = ['levels', 'styles', 'years'];

export type TeachAnswer = 'yes' | 'no' | null;

/**
 * The steps this person will see, in order. About is the organiser's About (plan A7), so it is only on
 * the path when there is a page to write it for. An unanswered teach keeps levels/styles/years on the
 * path (the bar must not jump forward before the answer).
 */
export const personPath = (teach: TeachAnswer, hasOrganiser: boolean): PersonStep[] =>
  PERSON_ORDER.filter((s) => !(teach === 'no' && TEACH_ONLY.includes(s)) && !(s === 'about' && !hasOrganiser));

/** Owner change 2: the bar shows a percentage. Step n of a path of N is round(n / N * 100). */
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

/** Nationality: the popular rows first (prototype POPULAR). Codes as the dancer editor stores them (alpha-2, or GB-ENG style). */
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
};

export const EMPTY_DRAFT: PersonDraft = { first_name: '', avatar_url: '', dance_role: '', nationality: '', languages: [], teach: null, levels: [], styles: [], years: '', about: '' };

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
}): PersonDraft {
  const d = reads.dancer ?? {};
  const teach: TeachAnswer = !reads.intent ? null : reads.intent.declined.includes('teacher') ? 'no' : reads.intent.roles.includes('teacher') ? 'yes' : null;
  const t = reads.teacher ?? {};
  const years = typeof t.years_teaching === 'number' && Number.isInteger(t.years_teaching) ? String(t.years_teaching) : '';
  return {
    first_name: str(d.first_name),
    avatar_url: str(d.avatar_url),
    dance_role: ROLE_OPTIONS.some((r) => r.value === d.dance_role) ? str(d.dance_role) : '',
    nationality: str(d.nationality),
    languages: strList(d.languages),
    teach,
    levels: strList(t.levels_taught).filter((l) => LEVELS.some((x) => x.value === l)),
    styles: strList(t.teaching_styles),
    years,
    about: reads.bio ?? '',
  };
}

export type StepCopy = { title: string; helper: string | null; reason: string | null; optional: boolean };

export const STEP_COPY: Record<PersonStep, StepCopy> = {
  name: { title: 'Your first name', helper: 'Goes on your dancer card.', reason: 'Type your first name to continue.', optional: false },
  photo: { title: 'Your photo', helper: 'Add a photo to continue. Dancers like to see who they’re meeting.', reason: 'Add a photo to continue.', optional: false },
  role: { title: 'How do you dance?', helper: null, reason: 'Pick one to continue.', optional: false },
  nat: { title: 'Nationality', helper: null, reason: 'Pick your nationality to continue.', optional: false },
  langs: { title: 'Languages you speak', helper: null, reason: null, optional: true },
  teach: { title: 'Do you teach?', helper: 'This shows on your teacher page.', reason: 'Answer to continue.', optional: false },
  levels: { title: 'Which levels?', helper: 'Tick all that apply.', reason: 'Pick at least one level to continue.', optional: false },
  styles: { title: 'Styles you teach', helper: null, reason: 'Pick at least one style to continue.', optional: false },
  years: { title: 'Years teaching', helper: '0 is fine.', reason: 'Type a number from 0 to 60 to continue.', optional: false },
  about: { title: 'About', helper: 'A sentence or two for the top of your page.', reason: null, optional: true },
  email: { title: 'Personal email', helper: null, reason: null, optional: true },
};

export const SAVE_FAILED = 'Couldn’t save. Check your connection and try again.';
export const READ_FAILED = 'We couldn’t load your details. Try again.';
export const UPLOAD_FAILED = 'That photo did not upload. Try again or pick another.';

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
    default: return null;
  }
}

/** What one Continue sends. Each kind is one existing RPC (personApi.ts). */
export type PersonCommand =
  | { kind: 'dancer'; patch: Record<string, unknown> }
  | { kind: 'teach'; yes: boolean }
  | { kind: 'teacher'; patch: Record<string, unknown> }
  | { kind: 'about'; bio: string }
  | { kind: 'signinEmail' };

/**
 * The command for Continue on this step, diff-first against what the server holds: an untouched
 * answer sends nothing (null). Email is the one exception: the person tapped "Save it privately" and
 * the RPC itself is a no-op when the private copy already matches (it never says which beforehand).
 */
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
    case 'email':
      return { kind: 'signinEmail' };
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
    case 'email': return held;
  }
}
