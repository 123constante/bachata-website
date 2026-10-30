import { addDateCommand, createDraftPayload, lifecycleCommand, newSeriesId, type OwnerCommand, type OwnerFormat } from '../../shared/seriesCommands';
import { createSeriesCommand } from '../../shared/selfServeApi';
import { A1_APPLIED } from '../../shared/a1Gate';
import { fullDate, WEEKDAY_NAMES } from '../../shared/dateWords';
import { TYPE_LABEL, type SessionType } from '../../shared/programmeModel';
import { parseTree } from '../../events/programmeSeriesModel';
import { PAYMENT_LABEL, PAYMENT_METHODS, type PaymentMethod } from '../../events/paymentModel';
import { priceLabel, pricesProblem, toPass, type PriceRow } from '../../events/seriesExtras';
import { blankDraft as blankRepeat, draftSig, endWords, patternWords, repeatProblem, rulePayload, type RepeatDraft, type RepeatFreq } from '../model/repeat';
import { emptyForm, everyAddAll, type SessForm } from '../data/sessions';
import type { VenueOption } from '../../shared/publicVenues';
import { P3_PATHS } from '../shell/paths';

/**
 * P3 New event (p3-create slice 1, design of record C "pick first"). Pure rules for the flow:
 * the kinds, the draft, what each row is missing, what stops a save, and the save plan (the
 * ordered series_command_p5 commands). Nothing is sent from here; an untouched draft plans [].
 * The repeat rule, the sessions tree, the prices and the payment codes come from the P3 / event
 * models (called, never copied). Times live on SESSIONS: the create never sends a series time.
 */

export type CreateKind = 'one_date' | 'weekly' | 'monthly' | 'course' | 'workshop' | 'festival' | 'class_party' | 'online' | 'other_dates';
/** How a kind asks "when": one date, a repeat rule from a first date, or dates picked one by one. */
export type WhenShape = 'date' | 'repeat' | 'dates';

export interface KindInfo {
  kind: CreateKind;
  label: string;
  hint: string;
  /** What the create sends; null for a kind not built yet. */
  format: OwnerFormat | null;
  when: WhenShape;
  freq?: RepeatFreq;
  /** The sessions a new draft of this kind starts with (each still needs its times). */
  sessions: SessionType[];
  /** Why the tile is off, said beside it; null = it can be picked. */
  deferred: string | null;
}

export const COMING_SOON = 'Coming soon';

/** The nine tiles, in the design's order (3 columns). Course, festival and online wait for slice 2 / admin. */
export const KINDS: readonly KindInfo[] = [
  { kind: 'one_date', label: 'One date', hint: 'A party or social on one night', format: 'one_off', when: 'date', sessions: ['party'], deferred: null },
  { kind: 'weekly', label: 'Weekly', hint: 'Same night every week, or a few weekdays', format: 'recurring', when: 'repeat', freq: 'weekly', sessions: ['class'], deferred: null },
  { kind: 'monthly', label: 'Monthly', hint: 'For example the first Saturday', format: 'recurring', when: 'repeat', freq: 'monthly', sessions: ['party'], deferred: null },
  { kind: 'course', label: 'Course', hint: 'Set number of classes, for example 8 Tuesdays', format: null, when: 'repeat', freq: 'weekly', sessions: ['class'], deferred: COMING_SOON },
  { kind: 'workshop', label: 'Workshop', hint: 'One day of classes with teachers', format: 'one_off', when: 'date', sessions: ['class', 'class'], deferred: null },
  { kind: 'festival', label: 'Festival', hint: 'Several days, passes, a line-up', format: null, when: 'date', sessions: [], deferred: COMING_SOON },
  { kind: 'class_party', label: 'Class, then party', hint: 'Two sessions on the same night', format: 'one_off', when: 'date', sessions: ['class', 'party'], deferred: null },
  { kind: 'online', label: 'Online', hint: 'A class or talk on a video link', format: null, when: 'date', sessions: ['class'], deferred: COMING_SOON },
  { kind: 'other_dates', label: 'Other dates', hint: 'Dates that follow no pattern', format: 'recurring', when: 'dates', sessions: ['party'], deferred: null },
];

export const kindInfo = (kind: string | null | undefined): KindInfo | null => KINDS.find((k) => k.kind === kind) ?? null;
/** A kind that can be built now (a deferred or unknown one is null). */
export const buildableKind = (kind: string | null | undefined): KindInfo | null => {
  const k = kindInfo(kind);
  return k && !k.deferred ? k : null;
};

// ---- the draft --------------------------------------------------------------------------

export interface CreateVenue { id: string; name: string; place: string | null; cityName: string | null }

export interface CreateDraft {
  v: 1;
  /** Chosen on the client: the cover uploads into its folder, then the create lands on it. */
  seriesId: string;
  kind: CreateKind;
  name: string;
  venue: CreateVenue | null;
  /** YYYY-MM-DD or ''. For "Other dates", the earliest picked date. */
  firstDate: string;
  repeat: RepeatDraft;
  /** "Other dates": every picked date after the first, sorted, no repeats. */
  extraDates: string[];
  sessions: SessForm[];
  pay: PaymentMethod[];
  prices: PriceRow[];
  ticketUrl: string;
}

export const NAME_MAX = 120;
/** The server lists at most 30 upcoming dates at a time (series.add_date refuses past it). */
export const DATES_MAX = 30;

const titleOf = (t: SessionType) => TYPE_LABEL[t] ?? t;

function repeatFor(freq: RepeatFreq | undefined): RepeatDraft {
  const r = blankRepeat(5);
  return freq === 'monthly' ? { ...r, freq: 'monthly', monthBy: 'nth', nths: [1] } : r;
}

export function blankCreate(kind: CreateKind, seriesId: string = newSeriesId()): CreateDraft {
  const k = kindInfo(kind);
  return {
    v: 1, seriesId, kind, name: '', venue: null, firstDate: '', repeat: repeatFor(k?.freq), extraDates: [],
    sessions: (k?.sessions ?? []).map((t) => ({ ...emptyForm(t), title: titleOf(t) })),
    pay: [], prices: [], ticketUrl: '',
  };
}

/** What the draft means, everything but its id (what "untouched" is measured on). */
export function createSig(d: CreateDraft): string {
  return JSON.stringify({
    k: d.kind, n: d.name.trim(), v: d.venue?.id ?? null, f: d.firstDate, r: draftSig(d.repeat), x: d.extraDates,
    s: d.sessions, p: d.pay, pr: d.prices.map(toPass), t: d.ticketUrl.trim(),
  });
}

/** Nothing typed or picked since the kind (a photo counts as a change). */
export const isUntouched = (d: CreateDraft, hasCover = false): boolean => !hasCover && createSig(d) === createSig(blankCreate(d.kind, d.seriesId));

// ---- dates ------------------------------------------------------------------------------

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const partsOf = (date: string) => date.split('-').map(Number);
const weekdayOf = (date: string) => { const [y, m, d] = partsOf(date); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const daysIn = (date: string) => { const [y, m] = partsOf(date); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
/** Which week of the month a date falls in: 1..5, and whether it is the last of its weekday. */
const nthOf = (date: string) => { const d = partsOf(date)[2]; return { nth: Math.ceil(d / 7), last: d + 7 > daysIn(date) }; };

/** The rule a first date suggests: its weekday (weekly), or its week and weekday / its day (monthly). */
function autoRepeat(r: RepeatDraft, date: string): RepeatDraft {
  if (r.freq === 'weekly') return { ...r, weekdays: [weekdayOf(date)] };
  const { nth } = nthOf(date);
  return { ...r, weekday: weekdayOf(date), nths: [nth <= 4 ? nth : -1], day: partsOf(date)[2] };
}

/**
 * A new first date. A rule nobody has changed by hand (blank, or still the one the old date
 * suggested) follows the date, so a Friday first date repeats on Friday.
 */
export function withFirstDate(d: CreateDraft, date: string): CreateDraft {
  const k = kindInfo(d.kind);
  if (k?.when !== 'repeat' || !ISO.test(date)) return { ...d, firstDate: date };
  const sig = draftSig(d.repeat);
  const followed = sig === draftSig(repeatFor(k.freq)) || (ISO.test(d.firstDate) && sig === draftSig(autoRepeat(d.repeat, d.firstDate)));
  return { ...d, firstDate: date, repeat: followed ? autoRepeat(d.repeat, date) : d.repeat };
}

/** "Other dates": every picked date, soonest first. */
export const chosenDates = (d: CreateDraft): string[] => (d.firstDate ? [d.firstDate, ...d.extraDates] : [...d.extraDates]);

function setChosen(d: CreateDraft, dates: string[]): CreateDraft {
  const all = [...new Set(dates.filter((x) => ISO.test(x)))].sort();
  return { ...d, firstDate: all[0] ?? '', extraDates: all.slice(1) };
}
export const addChosenDate = (d: CreateDraft, date: string) => setChosen(d, [...chosenDates(d), date]);
export const removeChosenDate = (d: CreateDraft, date: string) => setChosen(d, chosenDates(d).filter((x) => x !== date));

/** Whether the first date is one of the rule's own dates (else the event would get a stray first date). */
export function firstDateFits(r: RepeatDraft, date: string): boolean {
  if (r.freq === 'weekly') return r.weekdays.includes(weekdayOf(date));
  if (r.monthBy === 'day') return partsOf(date)[2] === r.day;
  const { nth, last } = nthOf(date);
  return weekdayOf(date) === r.weekday && (r.nths.includes(nth) || (last && r.nths.includes(-1)));
}

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};

/** Monthly on the 29th, 30th or 31st: said beside the day, never a refusal. */
export function monthDayWarning(r: RepeatDraft): string | null {
  if (r.freq !== 'monthly' || r.monthBy !== 'day' || !(r.day >= 29 && r.day <= 31)) return null;
  return `Not every month has a ${ordinal(r.day)}. Those months get no date.`;
}

// ---- the venue search ------------------------------------------------------------------

export const VENUE_ROWS_MAX = 50;
export function venueMatches(venues: readonly VenueOption[], term: string, max = VENUE_ROWS_MAX): VenueOption[] {
  const needle = term.trim().toLowerCase();
  return venues.filter((v) => !needle || v.name.toLowerCase().includes(needle) || (v.neighbourhood ?? '').toLowerCase().includes(needle)).slice(0, max);
}
export const venueOf = (v: VenueOption): CreateVenue => ({ id: v.id, name: v.name, place: v.neighbourhood ?? v.city_name ?? null, cityName: v.city_name ?? null });

// ---- what each row says, what is missing, what stops a save ----------------------------------

export const COPY = {
  kindTitle: 'What are you listing?',
  kindNote: 'You can change the dates later. Repeating events can also stop repeating.',
  pageTitle: 'Which page is this for?',
  pageNote: 'You run more than one page. The event shows under the page you pick.',
  nameEmpty: 'Give the event a name. Dancers search by it.',
  nameLong: `Keep the name to ${NAME_MAX} letters or fewer.`,
  nameFirst: 'Add a name to save or go live.',
  pastFirst: 'Pick a first date from today on.',
  pastDate: 'Every date must be from today on.',
  tooManyDates: `Up to ${DATES_MAX} dates can be listed at once. Remove some now, and add the rest later from the event page.`,
  noDates: 'No dates yet. Add the first date.',
  notFit: 'The first date is not one of the repeat dates. Pick a first date that matches the pattern, or change the pattern.',
  ticketUrl: 'A ticket link must start with https://',
  draftOnly: 'Going live needs the next platform update. Save it as a draft for now; you can go live from the event page.',
  sessionsNote: 'An event has no start or end of its own. Its time comes from the sessions: first start to last end.',
  noSessions: 'No sessions yet. Add one with its start and end. A party night is one session; a class and a party are two.',
  capNote: 'We list the next 30 dates and add more as they pass. Stop it any time from the event page.',
  venueNone: (term: string) => `No venue matches \u201c${term.trim()}\u201d`,
  venueNoneBody: 'Try another word from its name. Not listed yet? Tap Skip for now: the draft saves without a venue, and you can add it later from the event page once we have it. To ask us to add it, open Help.',
  venueLoading: 'Loading venues\u2026',
  venueError: 'We could not load the venue list. Check your signal and try again.',
  photoNote: 'JPEG, PNG or WebP under 10 MB.',
  leaveTitle: 'Leave this event?',
  leaveBody: 'Nothing is saved yet. Save it as a draft to finish later, or leave without saving.',
  leaveNoName: 'Nothing is saved yet. To keep it as a draft, add a name first.',
} as const;

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function nameProblem(name: string): string | null {
  if (!name.trim()) return COPY.nameEmpty;
  if (name.trim().length > NAME_MAX) return COPY.nameLong;
  return null;
}

const sessionsBuilt = (d: CreateDraft) => everyAddAll(parseTree(null), d.sessions);

/** Problems that stop ANY save (a draft too), by row; the first one is named beside Save. */
export interface RowProblems { name: string | null; when: string | null; sessions: string | null; price: string | null }

export function rowProblems(d: CreateDraft, today: string): RowProblems {
  const k = kindInfo(d.kind);
  let when: string | null = null;
  if (k?.when === 'dates') {
    const all = chosenDates(d);
    if (all.some((x) => x < today)) when = COPY.pastDate;
    else if (all.length > DATES_MAX) when = COPY.tooManyDates;
  } else if (d.firstDate) {
    if (d.firstDate < today) when = COPY.pastFirst;
    else if (k?.when === 'repeat') when = repeatProblem(d.repeat, today, d.firstDate) ?? (firstDateFits(d.repeat, d.firstDate) ? null : COPY.notFit);
  }
  const free = d.pay.includes('free');
  const price = (!free && d.prices.length ? pricesProblem(d.prices) : null)
    ?? (d.ticketUrl.trim() && !/^https:\/\/\S+$/i.test(d.ticketUrl.trim()) ? COPY.ticketUrl : null);
  return { name: d.name.trim() ? nameProblem(d.name) : null, when, sessions: d.sessions.length ? sessionsBuilt(d).problem : null, price };
}

/** Why Save draft is off, or null. A name is the one thing a draft needs. */
export function draftBlock(d: CreateDraft, today: string): string | null {
  if (!d.name.trim()) return COPY.nameFirst;
  const p = rowProblems(d, today);
  return p.name ?? p.when ?? p.sessions ?? p.price;
}

/**
 * What going live still needs, in words (the server's go-live check, _series_go_live_check_p5:
 * venue, an upcoming date, a session with a title and both times, a cover, how to pay).
 */
export function missingForLive(d: CreateDraft, hasCover: boolean): string[] {
  const k = kindInfo(d.kind);
  const out: string[] = [];
  if (!d.name.trim()) out.push('a name');
  if (!d.venue) out.push('where it is');
  if (!d.firstDate) out.push(k?.when === 'dates' ? 'a date' : 'the first date');
  if (!d.sessions.length) out.push('a session with its times');
  else if (d.sessions.some((s) => !s.start || !s.end)) out.push('a start and end on every session');
  if (!hasCover) out.push('a photo');
  if (!d.pay.length) out.push('how dancers pay');
  return out;
}

/** Why Go live is off, or null when it can go. */
export function liveBlock(d: CreateDraft, today: string, hasCover: boolean, a1 = A1_APPLIED): string | null {
  if (!a1) return COPY.draftOnly;
  const missing = missingForLive(d, hasCover);
  if (missing.length) return `Go live needs ${list(missing)}.${draftBlock(d, today) ? '' : ' Save draft works now.'}`;
  return draftBlock(d, today);
}

// ---- the rows' one-line summaries ---------------------------------------------------------

export function whenLine(d: CreateDraft, today: string): string {
  const k = kindInfo(d.kind);
  if (k?.when === 'dates') {
    const all = chosenDates(d);
    if (!all.length) return 'Not set';
    return all.length === 1 ? fullDate(all[0], today) : `${all.length} dates, from ${fullDate(all[0], today)}`;
  }
  return d.firstDate ? fullDate(d.firstDate, today) : 'Not set';
}

export const repeatLine = (d: CreateDraft, today: string): string => `${patternWords(d.repeat)}, ${endWords(d.repeat, today)}`;

export function sessionsLine(d: CreateDraft): string {
  if (!d.sessions.length) return 'Add at least one session with its times';
  return d.sessions.map((s) => `${s.title.trim() || (TYPE_LABEL[s.type ?? ''] ?? 'Session')} ${s.start && s.end ? `${s.start}\u2013${s.end}` : 'no times yet'}`).join(', ');
}

export function priceLine(d: CreateDraft): string {
  if (!d.pay.length) return 'Free, at the door or tickets';
  const how = PAYMENT_METHODS.filter((m) => d.pay.includes(m)).map((m) => PAYMENT_LABEL[m]).join(', ');
  const prices = d.pay.includes('free') ? [] : d.prices.filter((r) => r.price.trim()).map((r) => priceLabel(r));
  return prices.length ? `${how} \u00b7 ${prices.join(', ')}` : how;
}

export const weekdayName = (date: string) => WEEKDAY_NAMES[weekdayOf(date)];

/** "Free" stands alone: picking it clears the others, and any other way to pay clears it. */
export function togglePay(picked: readonly PaymentMethod[], m: PaymentMethod): PaymentMethod[] {
  if (picked.includes(m)) return picked.filter((p) => p !== m);
  if (m === 'free') return ['free'];
  return PAYMENT_METHODS.filter((p) => p !== 'free' && (p === m || picked.includes(p)));
}

// ---- the save plan ----------------------------------------------------------------------------

export type StepKey = 'cover' | 'create' | 'repeat' | 'sessions' | 'live' | `date:${string}`;
export interface PlanStep {
  key: StepKey;
  /** null for the cover: it is an upload into the series folder, not a command. */
  command: OwnerCommand | null;
}

export interface PlanInput {
  organiserId: string;
  today: string;
  hasCover: boolean;
  /** The uploaded cover's URL, once step 1 has run. */
  coverUrl: string | null;
  /** The series' city (createCity.resolveCreateCityId), when known. */
  cityId: string | null;
  goLive: boolean;
  a1?: boolean;
}

/** The create upsert's payload, WITHOUT the organiser key (createSeriesCommand adds it). Never a series time. */
export function createPayload(d: CreateDraft, input: Pick<PlanInput, 'coverUrl' | 'cityId'>): Record<string, unknown> {
  const k = kindInfo(d.kind)!;
  const payload: Record<string, unknown> = createDraftPayload(d.name, k.format!);
  if (d.firstDate) payload.default_start_date = d.firstDate;
  if (d.venue) payload.default_venue_id = d.venue.id;
  if (input.cityId) payload.default_city_id = input.cityId;
  if (input.coverUrl) payload.default_cover_image_url = input.coverUrl;
  if (d.pay.length) payload.payment_methods = PAYMENT_METHODS.filter((m) => d.pay.includes(m)).join(',');
  if (!d.pay.includes('free') && d.prices.length) payload.default_passes = d.prices.map(toPass);
  if (d.ticketUrl.trim()) payload.default_ticket_url = d.ticketUrl.trim();
  return payload;
}

/**
 * The fixed order (BUILD-INVENTORY "Fixed order"): the cover upload, the create (a draft), the
 * repeat rule (repeating kinds, with a first date), each extra date ("Other dates"), the sessions
 * (series.set_program, after every date exists so the server re-times the draft's dates from
 * them), then going live when asked and possible. [] when untouched, blocked, or Go live is off.
 */
export function savePlan(d: CreateDraft, input: PlanInput): PlanStep[] {
  const k = buildableKind(d.kind);
  const a1 = input.a1 ?? A1_APPLIED;
  if (!k || isUntouched(d, input.hasCover) || draftBlock(d, input.today)) return [];
  if (input.goLive && liveBlock(d, input.today, input.hasCover, a1)) return [];
  const steps: PlanStep[] = [];
  if (input.hasCover) steps.push({ key: 'cover', command: null });
  steps.push({ key: 'create', command: createSeriesCommand(createPayload(d, input), input.organiserId) });
  if (k.when === 'repeat' && d.firstDate) steps.push({ key: 'repeat', command: { kind: 'series.set_recurrence', payload: rulePayload(d.repeat) } });
  if (k.when === 'dates') d.extraDates.forEach((x) => steps.push({ key: `date:${x}`, command: addDateCommand(x) }));
  if (d.sessions.length) {
    const built = sessionsBuilt(d);
    if (built.command) steps.push({ key: 'sessions', command: built.command });
  }
  if (input.goLive) steps.push({ key: 'live', command: lifecycleCommand('live') });
  return steps;
}

/** What a step is called when it did not save ("Not saved yet: ..."). */
export function stepLabel(key: StepKey, today: string): string {
  if (key === 'cover') return 'the photo';
  if (key === 'create') return 'the event';
  if (key === 'repeat') return 'how it repeats';
  if (key === 'sessions') return 'the sessions';
  if (key === 'live') return 'going live';
  return `the date ${fullDate(key.slice(5), today)}`;
}

export const notSavedLine = (keys: StepKey[], today: string): string => {
  const words = list(keys.map((k) => stepLabel(k, today)));
  return `Not saved yet: ${words}.`;
};

export const RESULT_COPY = {
  savedDraft: 'Saved as a draft. Nobody else can see it yet. Go live from here when it is ready.',
  live: 'It is live. Dancers can find it now.',
  nothingSaved: 'Nothing was saved',
  partTitle: 'Your draft is saved, but not all of it',
  partBody: 'Try again to finish it here, open the draft to finish it there, or discard it. It also shows on Home under Needs you, and in Events with a Draft tag.',
  detailsTitle: 'A few details first',
  detailsBody: (name: string) => `\u201c${name.trim()}\u201d is saved as a draft. Before it goes live, answer a few quick questions so dancers know who runs it.`,
  onboardingTitle: 'Finish your details first',
  discarded: 'Draft discarded.',
  discardFailed: 'The draft could not be discarded. Check your connection and try again, or open it and discard it from there.',
} as const;

// ---- the steps of the route ------------------------------------------------------------------

export type CreateAt = 'kind' | 'page' | 'form';

export const parseAt = (raw: string | null): CreateAt => (raw === 'page' || raw === 'form' ? raw : 'kind');

/** The route's steps for a kind: the page question only for a login with 2 or more pages. */
export const stepsFor = (pageCount: number): CreateAt[] => (pageCount >= 2 ? ['kind', 'page', 'form'] : ['kind', 'form']);

/** Where Back goes from a step: always inside P3, the kind picker's Back is Cancel (Events). */
export function backOf(at: CreateAt, kind: string, organiserId: string | null, pageCount: number): { to: string; label: string } {
  if (at === 'kind') return { to: P3_PATHS.events, label: 'Cancel' };
  if (at === 'page') return { to: P3_PATHS.createFor(organiserId), label: 'Back' };
  return pageCount >= 2 ? { to: P3_PATHS.createStep('page', kind, organiserId), label: 'Back' } : { to: P3_PATHS.createFor(organiserId), label: 'Back' };
}

/** Where a picked kind goes next. */
export const afterKind = (kind: CreateKind, organiserId: string | null, pageCount: number): string =>
  P3_PATHS.createStep(pageCount >= 2 ? 'page' : 'form', kind, organiserId);

// ---- the draft kept across steps (sessionStorage, a convenience only) --------------------------

export const DRAFT_STORE_KEY = 'p3-create-draft';

/** A stored draft, or null when it is not one this flow wrote (a bad one is ignored, never trusted). */
export function parseStoredDraft(raw: string | null): CreateDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<CreateDraft>;
    if (!d || d.v !== 1 || typeof d.seriesId !== 'string' || !buildableKind(d.kind)) return null;
    const blank = blankCreate(d.kind as CreateKind, d.seriesId);
    return {
      ...blank,
      name: typeof d.name === 'string' ? d.name : '',
      venue: d.venue && typeof d.venue.id === 'string' ? d.venue : null,
      firstDate: typeof d.firstDate === 'string' ? d.firstDate : '',
      repeat: d.repeat && typeof d.repeat === 'object' ? { ...blank.repeat, ...d.repeat } : blank.repeat,
      extraDates: Array.isArray(d.extraDates) ? d.extraDates.filter((x) => typeof x === 'string') : [],
      sessions: Array.isArray(d.sessions) ? d.sessions : blank.sessions,
      pay: Array.isArray(d.pay) ? d.pay.filter((m): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m)) : [],
      prices: Array.isArray(d.prices) ? d.prices : [],
      ticketUrl: typeof d.ticketUrl === 'string' ? d.ticketUrl : '',
    };
  } catch {
    return null;
  }
}
