import { nextDateOnWeekday, isHttpUrl } from '../../shared/createModel';
import { addDaysToKey } from '@/lib/londonDate';
import type { VenueOption } from '../../shared/publicVenues';
import type { PriceRow, Currency } from '../../events/seriesExtras';
import { emptyForm, type SessForm } from '../data/sessions';
import { DATES_MAX, NAME_MAX, blankCreate, kindInfo, venueMatches, venueOf, withFirstDate, type CreateDraft, type CreateKind } from './model';
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
const LABEL_MAX = 60;
const SAID_MAX = 200;

/** Untrusted flyer text: URLs out, whitespace collapsed, capped. */
export function cleanText(s: string | null | undefined, max: number): string {
  return (s ?? '').replace(URL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
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

  if (repeating && weekday !== null && kind !== 'course') {
    draft = withFirstDate(draft, nextDateOnWeekday(today, weekday));
    repeatNote();
  } else if (first?.date_start) {
    draft = withFirstDate(draft, first.date_start);
    if (repeating) repeatNote();
    if (first.date_start < today) {
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
  if (read.price) {
    const cur = read.price.currency.toUpperCase();
    const currency: Currency = cur === 'EUR' || cur === 'USD' ? cur : 'GBP';
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
