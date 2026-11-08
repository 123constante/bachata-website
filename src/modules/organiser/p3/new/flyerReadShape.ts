/**
 * flyer_read_shape_v1 -- the typed copy of the event-flyer-read response. The admin repo
 * (bachata-admin-11april, the flyer read function) is the source of truth; this copy only
 * lets the Website build and test against it. parseFlyerRead never throws: off-shape = null.
 */

export type FlyerKind = 'one_off' | 'weekly' | 'monthly' | 'course' | 'festival' | 'multi_event' | 'not_enough';
export type FlyerSessionType = 'class' | 'party' | 'social' | 'workshop' | 'doors' | 'other';

export interface FlyerDate {
  date_start: string | null;
  date_end: string | null;
  year_printed: boolean;
  weekday_printed: number | null;
  recurrence_text: string | null;
}

export interface FlyerSession {
  type: FlyerSessionType;
  start: string | null;
  end: string | null;
  label: string | null;
}

export interface FlyerRead {
  kind: FlyerKind;
  event_count_on_flyer: number;
  title: string | null;
  organiser_text: string | null;
  dates: FlyerDate[];
  start_time: string | null;
  end_time: string | null;
  ends_after_midnight: boolean;
  venue_name: string | null;
  venue_address: string | null;
  sessions: FlyerSession[];
  price: { amount_pence: number; currency: string } | null;
  ticket_url_visible: string | null;
  doubtful_fields: string[];
  notes: string | null;
}

const KINDS: readonly string[] = ['one_off', 'weekly', 'monthly', 'course', 'festival', 'multi_event', 'not_enough'];
const STYPES: readonly string[] = ['class', 'party', 'social', 'workshop', 'doors', 'other'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strOrNull = (v: unknown): string | null | undefined => (v === null || v === undefined ? null : typeof v === 'string' ? v : undefined);
const dateOrNull = (v: unknown): string | null | undefined => (v === null || v === undefined ? null : typeof v === 'string' && ISO.test(v) ? v : undefined);
const timeOrNull = (v: unknown): string | null | undefined => (v === null || v === undefined ? null : typeof v === 'string' && HHMM.test(v) ? v : undefined);

export function parseFlyerRead(raw: unknown): FlyerRead | null {
  try {
    if (!isObj(raw) || typeof raw.kind !== 'string' || !KINDS.includes(raw.kind)) return null;
    const count = raw.event_count_on_flyer === undefined || raw.event_count_on_flyer === null ? 1 : raw.event_count_on_flyer;
    if (typeof count !== 'number' || !Number.isFinite(count)) return null;
    const title = strOrNull(raw.title), org = strOrNull(raw.organiser_text), vn = strOrNull(raw.venue_name);
    const va = strOrNull(raw.venue_address), url = strOrNull(raw.ticket_url_visible), notes = strOrNull(raw.notes);
    const st = timeOrNull(raw.start_time), et = timeOrNull(raw.end_time);
    if ([title, org, vn, va, url, notes, st, et].some((x) => x === undefined)) return null;
    const datesIn = raw.dates ?? [];
    const sessIn = raw.sessions ?? [];
    const dbl = raw.doubtful_fields ?? [];
    if (!Array.isArray(datesIn) || !Array.isArray(sessIn) || !Array.isArray(dbl) || !dbl.every((x) => typeof x === 'string')) return null;
    const dates: FlyerDate[] = [];
    for (const d of datesIn) {
      if (!isObj(d)) return null;
      const a = dateOrNull(d.date_start), b = dateOrNull(d.date_end), rt = strOrNull(d.recurrence_text);
      const wd = d.weekday_printed ?? null;
      if (a === undefined || b === undefined || rt === undefined) return null;
      if (wd !== null && !(typeof wd === 'number' && Number.isInteger(wd) && wd >= 0 && wd <= 6)) return null;
      dates.push({ date_start: a, date_end: b, year_printed: d.year_printed === true, weekday_printed: wd as number | null, recurrence_text: rt });
    }
    const sessions: FlyerSession[] = [];
    for (const s of sessIn) {
      if (!isObj(s) || typeof s.type !== 'string' || !STYPES.includes(s.type)) return null;
      const a = timeOrNull(s.start), b = timeOrNull(s.end), l = strOrNull(s.label);
      if (a === undefined || b === undefined || l === undefined) return null;
      sessions.push({ type: s.type as FlyerSessionType, start: a, end: b, label: l });
    }
    let price: FlyerRead['price'] = null;
    if (raw.price !== null && raw.price !== undefined) {
      const p = raw.price;
      if (!isObj(p) || typeof p.amount_pence !== 'number' || !Number.isFinite(p.amount_pence) || p.amount_pence < 0 || typeof p.currency !== 'string') return null;
      price = { amount_pence: p.amount_pence, currency: p.currency };
    }
    return {
      kind: raw.kind as FlyerKind, event_count_on_flyer: count, title, organiser_text: org, dates, start_time: st, end_time: et,
      ends_after_midnight: raw.ends_after_midnight === true, venue_name: vn, venue_address: va, sessions, price,
      ticket_url_visible: url, doubtful_fields: dbl as string[], notes,
    };
  } catch {
    return null;
  }
}
