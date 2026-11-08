import { nextDateOnWeekday, isHttpUrl } from '../../shared/createModel';
import { addDaysToKey, weekdayOfKey } from '@/lib/londonDate';
import type { VenueOption } from '../../shared/publicVenues';
import type { PriceRow, Currency } from '../../events/seriesExtras';
import { emptyForm, type SessForm } from '../data/sessions';
import { DATES_MAX, NAME_MAX, blankCreate, firstDateFits, kindInfo, venueMatches, venueOf, withFirstDate, type CreateDraft, type CreateKind } from './model';
import type { FlyerRead, FlyerSession } from './flyerReadShape';

/**
 * flyerToDraft: what the flyer reader returned -> a P3 New event draft, the doubtful fields and a
 * tick list of sessions. Pure: no network, never saves. Description, cover, category and teachers
 * are not touched. Flyer text is untrusted: URLs are stripped (except the ticket link), whitespace
 * collapsed, lengths capped.
 */

export type DraftFieldKey = 'name' | 'venue' | 'firstDate' | 'extraDates' | 'sessions' | 'prices' | 'ticketUrl';
const FIELD_KEYS: readonly DraftFieldKey[] = ['name', 'venue', 'firstDate', 'extraDates', 'sessions', 'prices', 'ticketUrl'];

export interface SessionChoice { id: string; label: string; type: string | null; start: string; end: string; ticked: boolean }
export interface NoteLine { code: string; text: string }
export interface FlyerDraftResult {
  draft: CreateDraft;
  doubtful: DraftFieldKey[];
  venueSaid: string | null;
  sessionChoices: SessionChoice[];
  notes: NoteLine[];
}

const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
/**
 * N2: a bare domain with a known TLD (bachata.co.uk/tix, salsa.london, BACHATA.CO.UK), plus any
 * path after it. Case-sensitive on purpose: OCR'd text like "Night.Live" or "Studio.Dance" (no
 * space after a full stop) is a sentence, not a link, and is kept.
 */
const TLDS = 'com|net|org|uk|london|io|co|es|eu|ie|de|fr|it|nl|pt|info|biz|events|event|dance|club|app|me|ly|link|site|online|shop|store|tickets|party|live|tv|page|so';
const DOMAIN_RE = new RegExp(`\\b(?:[a-z0-9][a-z0-9-]*(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})|[A-Z0-9][A-Z0-9-]*(?:\\.[A-Z0-9-]+)*\\.(?:${TLDS.toUpperCase()}))\\b(?:\\/\\S*)?`, 'g');
const LABEL_MAX = 60;
const SAID_MAX = 200;

/** Untrusted flyer text: URLs out, whitespace collapsed, capped. */
export function cleanText(s: string | null | undefined, max: number): string {
  const raw = (s ?? '').replace(/\s+/g, ' ');
  let out = raw.replace(URL_RE, ' ').replace(DOMAIN_RE, ' ').replace(/\s+/g, ' ');
  // where a link was cut out, tidy the punctuation it leaves behind ("Hall, " -> "Hall")
  if (out !== raw) out = out.replace(/\s+([,;:])/g, '$1').replace(/^[\s,;:]+|[\s,;:]+$/g, '');
  return out.trim().slice(0, max).trim();
}

function ticketUrlOf(raw: string | null): string {
  let u = (raw ?? '').trim();
  if (/^www\./i.test(u)) u = `https://${u}`;
  return u && isHttpUrl(u) ? u.slice(0, 500) : '';
}

const SESSION_TYPE: Record<string, string | null> = { class: 'class', workshop: 'class', party: 'party', social: 'party', doors: null, other: null };

function kindOf(read: FlyerRead): CreateKind {
  switch (read.kind) {
    case 'weekly': return 'weekly';
    case 'monthly': return 'monthly';
    case 'course': return 'course';
    case 'festival': return 'festival';
    case 'one_off': {
      const types = read.sessions.map((s) => s.type);
      return types.includes('class') && types.includes('party') ? 'class_party' : 'one_date';
    }
    default: return 'one_date';
  }
}

const DOUBT_NAMES: Record<string, DraftFieldKey> = {
  name: 'name', title: 'name', venue: 'venue', venue_name: 'venue', venue_address: 'venue', firstDate: 'firstDate', first_date: 'firstDate',
  date: 'firstDate', dates: 'firstDate', date_start: 'firstDate', extraDates: 'extraDates', extra_dates: 'extraDates', date_end: 'extraDates',
  sessions: 'sessions', prices: 'prices', price: 'prices', ticketUrl: 'ticketUrl', ticket_url: 'ticketUrl', ticket_url_visible: 'ticketUrl',
};

const WEEKDAY_WORD = '(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*';
const ORDINALS: Record<string, number> = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4 };
/**
 * "1st Saturday", "first Friday of the month", "last Sunday": 1..4, -1 (last), or null when the
 * flyer does not say exactly one week ("1st and 3rd Friday" = null: never guess). "last" counts
 * only before a weekday ("last entry 1am" is not a week).
 */
export function nthFromText(text: string | null | undefined): number | null {
  const t = (text ?? '').toLowerCase();
  const found = new Set<number>();
  for (const m of t.matchAll(/\b(1st|first|2nd|second|3rd|third|4th|fourth)\b/g)) found.add(ORDINALS[m[1]]);
  if (new RegExp(`\\blast\\s+${WEEKDAY_WORD}\\b`).test(t)) found.add(-1);
  return found.size === 1 ? [...found][0] : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** The nth (1..4) or last (-1) `weekday` of month `m` (1..12) of year `y`, as YYYY-MM-DD. */
function nthWeekdayOfMonth(y: number, m: number, weekday: number, nth: number): string {
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d1 = 1 + ((weekday - new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 7) % 7);
  const d = nth === -1 ? d1 + 7 * Math.floor((days - d1) / 7) : d1 + 7 * (nth - 1);
  return `${y}-${pad(m)}-${pad(d)}`;
}
/** The first nth-weekday date on or after `today`: this month's, else next month's. */
export function nextNthWeekday(today: string, weekday: number, nth: number): string {
  const [y, m] = today.split('-').map(Number);
  const here = nthWeekdayOfMonth(y, m, weekday, nth);
  return here >= today ? here : m === 12 ? nthWeekdayOfMonth(y + 1, 1, weekday, nth) : nthWeekdayOfMonth(y, m + 1, weekday, nth);
}

const CURRENCY_WORDS: Record<string, Currency> = { GBP: 'GBP', '\u00a3': 'GBP', POUND: 'GBP', POUNDS: 'GBP', EUR: 'EUR', '\u20ac': 'EUR', EURO: 'EUR', EUROS: 'EUR', USD: 'USD', $: 'USD' };
/** GBP / EUR / USD (code, symbol or word, any case), else null. */
const currencyOf = (raw: string | null | undefined): Currency | null => CURRENCY_WORDS[(raw ?? '').trim().toUpperCase()] ?? null;

export function flyerToDraft(read: FlyerRead, venues: readonly VenueOption[], today: string): FlyerDraftResult {
  const kind = kindOf(read);
  let draft = blankCreate(kind);
  const doubtful = new Set<DraftFieldKey>();
  const notes: NoteLine[] = [];
  const note = (code: string, text: string) => notes.push({ code, text });

  for (const f of read.doubtful_fields) {
    const k = DOUBT_NAMES[f];
    if (k && FIELD_KEYS.includes(k)) doubtful.add(k);
  }

  draft.name = cleanText(read.title, NAME_MAX);

  if (read.event_count_on_flyer > 1) note('many_events', `This flyer has ${read.event_count_on_flyer} events, the others are not read.`);

  const first = read.dates.find((d) => d.date_start) ?? null;
  const weekday = read.dates.find((d) => d.weekday_printed !== null)?.weekday_printed ?? null;
  const notEnough = read.kind === 'not_enough' || (!first && weekday === null && !(read.venue_name || read.venue_address));
  const repeating = kindInfo(kind)?.when === 'repeat';
  const repeatNote = () => note('repeats', `This repeats every ${kind === 'monthly' ? 'month' : 'week'}, set how it repeats below.`);

  const recNth = nthFromText(read.dates.map((d) => d.recurrence_text).find(Boolean) ?? null);
  if (first?.date_start) {
    // N1: a printed date always wins (also on a repeating flyer), with its own weekday and week of the month
    const printed = first.date_start;
    draft = withFirstDate(draft, printed);
    if (repeating) repeatNote();
    if (weekday !== null && weekdayOfKey(printed) !== weekday) doubtful.add('firstDate');
    if (kind === 'monthly' && draft.repeat.monthBy === 'nth' && recNth !== null) {
      // the rule must carry the flyer's own week of the month; a printed date that is not that week is doubtful
      const rule = { ...draft.repeat, nths: [recNth] };
      if (firstDateFits(rule, printed)) draft = { ...draft, repeat: { ...draft.repeat, nths: [recNth] } };
      else doubtful.add('firstDate');
    }
    if (printed < today) {
      doubtful.add('firstDate');
      note('past_date', 'This date has passed.');
    }
    // a range (festival or several days): every further day up to date_end
    const end = first.date_end;
    if (end && end > first.date_start && !repeating) {
      const days: string[] = [];
      for (let d = addDaysToKey(first.date_start, 1); d <= end && days.length <= DATES_MAX; d = addDaysToKey(d, 1)) days.push(d);
      if (days.length > DATES_MAX) {
        draft.extraDates = days.slice(0, DATES_MAX);
        note('too_many_dates', `The flyer spans more than ${DATES_MAX} days. The first ${DATES_MAX} are listed.`);
        doubtful.add('extraDates');
      } else {
        draft.extraDates = days;
      }
    }
  } else if (repeating && weekday !== null && kind !== 'course') {
    // only a weekday was printed: the date is computed, so it is always marked to check
    repeatNote();
    if (kind === 'monthly') {
      if (recNth !== null) {
        draft = withFirstDate(draft, nextNthWeekday(today, weekday, recNth));
        draft = { ...draft, repeat: { ...draft.repeat, monthBy: 'nth', weekday, nths: [recNth] } };
      }
      // never guess the week of the month: no nth on the flyer = no date
    } else {
      draft = withFirstDate(draft, nextDateOnWeekday(today, weekday));
    }
    doubtful.add('firstDate');
  }
  if (!draft.firstDate && !notEnough) note('no_date', 'No date was found on the flyer. Add the first date.');

  // venue: only when exactly one venue matches the flyer's own name
  const said = [cleanText(read.venue_name, SAID_MAX), cleanText(read.venue_address, SAID_MAX)].filter(Boolean);
  let venueSaid: string | null = null;
  const nameTerm = cleanText(read.venue_name, SAID_MAX);
  const hits = nameTerm ? venueMatches(venues, nameTerm, venues.length || 1) : [];
  if (hits.length === 1) {
    draft.venue = venueOf(hits[0]);
  } else if (said.length) {
    venueSaid = said.join(', ');
    doubtful.add('venue');
  } else if (!notEnough) {
    doubtful.add('venue');
    note('no_venue', 'No venue was found on the flyer. Pick one.');
  }

  // sessions: offered as a tick list, never added here
  const sessionChoices: SessionChoice[] = read.sessions.map((s: FlyerSession, i) => ({
    id: `s${i}`,
    label: cleanText(s.label, LABEL_MAX) || (s.type === 'other' ? 'Session' : s.type[0].toUpperCase() + s.type.slice(1)),
    type: SESSION_TYPE[s.type] ?? null,
    start: s.start ?? '',
    end: s.end ?? '',
    ticked: !doubtful.has('sessions'),
  }));

  // price: a single clear price, one row
  // N5: an unknown currency gives no row (never a silent GBP), and a note says to add the price
  const cur = currencyOf(read.price?.currency);
  if (read.price && !cur) note('price_currency', 'The flyer shows a price we could not use. Add it below if you want one.');
  if (read.price && cur) {
    const currency: Currency = cur;
    const pounds = read.price.amount_pence / 100;
    const row: PriceRow = { id: 'flyer-price', name: 'Ticket', price: String(Number.isInteger(pounds) ? pounds : pounds.toFixed(2)), currency };
    draft.prices = [row];
    doubtful.add('prices');
  }

  const url = ticketUrlOf(read.ticket_url_visible);
  if (url) { draft.ticketUrl = url; doubtful.add('ticketUrl'); }

  if (notEnough) {
    const missing = [!draft.firstDate && 'a date', !draft.venue && !venueSaid && 'a venue', !draft.name && 'a name'].filter(Boolean).join(', ');
    note('not_enough', `Not enough was readable on this flyer${missing ? ` (missing ${missing})` : ''}. Fill in the rest below.`);
  }

  return { draft, doubtful: FIELD_KEYS.filter((k) => doubtful.has(k)), venueSaid, sessionChoices, notes };
}

/** Adds only the ticked choices to the draft's sessions (replacing the blank starter sessions). */
export function applySessionChoices(draft: CreateDraft, choices: readonly SessionChoice[]): CreateDraft {
  const ticked = choices.filter((c) => c.ticked);
  if (!ticked.length) return draft;
  // SessForm keeps start/end as HH:MM; an end earlier than the start is the next day, exactly as the form expects.
  const sessions: SessForm[] = ticked.map((c) => ({ ...emptyForm((c.type ?? 'party') as never), type: c.type ?? 'party', title: c.label, start: c.start, end: c.end }));
  return { ...draft, sessions };
}
