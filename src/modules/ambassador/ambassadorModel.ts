import { londonDateKey, londonDaysBetweenKeys, parseUtcIso, weekdayOfKey } from '@/lib/londonDate';

/** One row of the ambassador pending queue. Deliberately has NO email field:
 *  `parseQueueRow` drops `submitter_email` at the boundary, so nothing downstream can render it. */
export type TargetType = 'organiser' | 'series';

export interface QueueItem {
  key: string;
  targetType: TargetType;
  targetId: string;
  name: string;
  cityId: string;
  cityName: string;
  /** The RPC's `submitted_at` is really `updated_at`: it means "last changed". */
  changedAt: string | null;
  organiserNames: string[];
  nextDates: string[];
  futureCount: number;
  venueName: string | null;
  priceMin: number | null;
  priceMax: number | null;
  hasFlyer: boolean;
  publicSlug: string | null;
}

export const PAGE_SIZE = 100;
/** A decision on an item the ambassador is party to is refused with this code. */
export const SELF_APPROVAL_CODE = 'self_approval_not_allowed';
export const MIN_REASON_LENGTH = 10;

export const itemKey = (type: string, id: string) => `${type}:${id}`;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : []);

export function parseQueueRow(raw: unknown): QueueItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.target_type === 'organiser' || r.target_type === 'series' ? r.target_type : null;
  const id = str(r.target_id);
  if (!type || !id) return null;
  return {
    key: itemKey(type, id),
    targetType: type,
    targetId: id,
    name: str(r.name) ?? (type === 'series' ? 'Unnamed series' : 'Unnamed organiser'),
    cityId: str(r.city_id) ?? '',
    cityName: str(r.city_name) ?? '',
    changedAt: str(r.submitted_at),
    organiserNames: strList(r.organiser_names),
    nextDates: strList(r.next_occurrence_dates).slice(0, 3),
    futureCount: num(r.future_occurrence_count) ?? 0,
    venueName: str(r.venue_name),
    priceMin: num(r.price_min),
    priceMax: num(r.price_max),
    hasFlyer: r.has_flyer === true,
    publicSlug: str(r.public_slug),
  };
}

export function parseQueueRows(raw: unknown): QueueItem[] {
  return Array.isArray(raw) ? raw.map(parseQueueRow).filter((x): x is QueueItem => x !== null) : [];
}

/** Oldest change first (the RPC returns newest first). Stable on ties. */
export function sortOldestFirst(items: readonly QueueItem[]): QueueItem[] {
  const t = (i: QueueItem) => parseUtcIso(i.changedAt)?.getTime() ?? Number.POSITIVE_INFINITY;
  return items.map((it, n) => ({ it, n })).sort((a, b) => t(a.it) - t(b.it) || a.n - b.n).map((x) => x.it);
}

/** Whole London calendar days since the item last changed. Never negative. */
export function waitingDays(item: Pick<QueueItem, 'changedAt'>, now: Date = new Date()): number {
  const d = parseUtcIso(item.changedAt);
  if (!d) return 0;
  return Math.max(0, londonDaysBetweenKeys(londonDateKey(d), londonDateKey(now)));
}

export const OLD_AFTER_DAYS = 7;
export const isOld = (days: number) => days >= OLD_AFTER_DAYS;

/** "today", "1 day", "9 days": the ONE age phrase every screen uses. */
export const ageText = (days: number) => (days <= 0 ? 'today' : days === 1 ? '1 day' : `${days} days`);
export const waitingChip = (days: number) => (days <= 0 ? 'Waiting since today' : `Waiting ${ageText(days)}`);
export const changedText = (days: number) => (days <= 0 ? 'Last changed today' : `Last changed ${ageText(days)} ago`);

export const typeLabel = (t: TargetType) => (t === 'series' ? 'Series' : 'Organiser');
export const typeNoun = (t: TargetType) => (t === 'series' ? 'series' : 'page');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Thursday 29 October" from a London calendar key; the raw text if it is not a key. */
export function dateLabel(key: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  const month = Number(key.slice(5, 7)) - 1;
  return `${WEEKDAYS[weekdayOfKey(key)]} ${Number(key.slice(8, 10))} ${MONTHS[month] ?? ''}`.trim();
}

export function priceText(i: Pick<QueueItem, 'priceMin' | 'priceMax'>): string {
  const { priceMin: lo, priceMax: hi } = i;
  if (lo == null && hi == null) return 'Price not given';
  const a = lo ?? hi ?? 0;
  const b = hi ?? lo ?? 0;
  if (a === 0 && b === 0) return 'Free';
  const money = (n: number) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;
  return a === b ? money(a) : `${money(a)}–${money(b)}`;
}

/** Name shortened for a toast. */
export const shortName = (name: string) => (name.length > 34 ? `${name.slice(0, 34)}…` : name);

export const leftText = (n: number) => (n === 0 ? 'None left.' : `${n} left.`);
export const decisionToast = (verb: 'Approved' | 'Rejected', name: string, left: number) => `${verb}: ${shortName(name)}. ${leftText(left)}`;

export interface ReasonCheck { ok: boolean; error: 'empty' | 'short' | null; length: number; message: string }
export function checkReason(text: string): ReasonCheck {
  const length = text.trim().length;
  if (length === 0) return { ok: false, error: 'empty', length, message: 'Say why, so the organiser knows what to fix.' };
  if (length < MIN_REASON_LENGTH) {
    return { ok: false, error: 'short', length, message: `Add a little more detail (${length} of ${MIN_REASON_LENGTH} characters so far).` };
  }
  return { ok: true, error: null, length, message: '' };
}

export type DecisionErrorKind = 'party' | 'gone' | 'access' | 'reason' | 'other';
export interface DecisionError { kind: DecisionErrorKind; message: string }

/** Every error code the decision RPCs raise, as something a volunteer can read. Never the raw code. */
export function decisionError(err: unknown): DecisionError {
  const text = (() => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const e = err as { message?: unknown; code?: unknown; details?: unknown };
      return [e.message, e.code, e.details].filter((x) => typeof x === 'string').join(' ');
    }
    return '';
  })().toLowerCase();
  if (text.includes(SELF_APPROVAL_CODE)) {
    return { kind: 'party', message: 'You are part of this one, so an admin has to decide it.' };
  }
  if (/not_found|not_pending|already|invalid_state|not_in_review|wrong_state/.test(text)) {
    return { kind: 'gone', message: 'This one is no longer waiting. Someone else may have decided it. Refresh the list to see what is left.' };
  }
  if (/reason/.test(text)) {
    return { kind: 'reason', message: 'The reason was not accepted. Add a little more detail and try again.' };
  }
  if (/42501|forbidden|not_authori|admin_only|permission|city_scope|not_in_scope/.test(text)) {
    return { kind: 'access', message: 'You do not have access to decide this one. Ask an admin to check your city.' };
  }
  return { kind: 'other', message: 'That did not go through. Nothing was changed. Check your connection and try again.' };
}

/** The decision RPCs return Json; a soft refusal can arrive as data instead of an error. */
export function softRefusal(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { ok?: unknown; error?: unknown; code?: unknown };
  if (d.ok === false || typeof d.error === 'string') return String(d.error ?? d.code ?? 'refused');
  return null;
}

export const reviewPath = (i: Pick<QueueItem, 'targetType' | 'targetId'>) => `/ambassador/review/${i.targetType}/${encodeURIComponent(i.targetId)}`;

/** Public page for the preview link, or null when the item has no slug yet. */
export function previewHref(i: Pick<QueueItem, 'targetType' | 'publicSlug' | 'targetId'>): string | null {
  if (!i.publicSlug) return null;
  // Series have no public page of their own yet, so only organisers get a preview link.
  return i.targetType === 'organiser' ? `/organisers/${encodeURIComponent(i.targetId)}` : null;
}
