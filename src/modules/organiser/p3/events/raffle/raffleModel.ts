// Organiser Raffle inside a night (Option B). ONE copy of every raffle fact the screens show: the parse of
// organiser_raffle_nights_v1 / organiser_raffle_night_set_v1 (admin PR #1576, NOT applied to prod yet; shapes in
// docs/briefs/profile-dash-organiser-raffle-rpc-reference.md), the 4-step track, the status story, the gate that says
// why the button is off, and the confirmation copy. The Website only toggles the per-night switch: the draw is admin's.

export const CHIPS = ['draft', 'cancelled', 'past', 'drawn', 'locked', 'open', 'closed'] as const;
export type Chip = (typeof CHIPS)[number];

export interface RaffleWinner { firstName: string | null; drawnAt: string | null; entriesAtDraw: number | null }

export interface RaffleNight {
  occurrenceId: string;
  date: string;
  startLocal: string | null;
  chip: Chip;
  raffleOn: boolean;
  entries: number;
  locked: boolean;
  winner: RaffleWinner | null;
  canSet: boolean;
  refuseReason: string | null;
}

export interface RaffleRead {
  seriesId: string;
  canEdit: boolean;
  /** 'ask an owner' for a contributor, else null. */
  viewOnlyReason: string | null;
  nights: RaffleNight[];
}

export type ReadResult = { kind: 'ok'; read: RaffleRead } | { kind: 'refused' };

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseNight(v: unknown): RaffleNight | null {
  const o = obj(v);
  const chip = str(o?.chip);
  const id = str(o?.occurrence_id);
  const date = str(o?.date);
  if (!o || !id || !date || !chip || !(CHIPS as readonly string[]).includes(chip)) return null;
  const w = obj(o.winner);
  return {
    occurrenceId: id,
    date: date.slice(0, 10),
    startLocal: str(o.start_local),
    chip: chip as Chip,
    raffleOn: o.raffle_on === true,
    entries: Math.max(0, num(o.entries_count) ?? 0),
    locked: o.locked === true,
    winner: w ? { firstName: str(w.first_name), drawnAt: str(w.drawn_at) ?? str(w.locked_at), entriesAtDraw: num(w.entries_at_draw) } : null,
    canSet: o.can_set === true,
    refuseReason: str(o.refuse_reason),
  };
}

/** organiser_raffle_nights_v1. ok:false (any reason) is a refusal, shown as "no access"; anything unreadable throws. */
export function parseRead(data: unknown): ReadResult {
  const o = obj(data);
  if (!o) throw new Error('raffle read: unreadable');
  if (o.ok !== true) return { kind: 'refused' };
  if (!Array.isArray(o.nights)) throw new Error('raffle read: no nights');
  return {
    kind: 'ok',
    read: {
      seriesId: str(o.series_id) ?? '',
      canEdit: o.can_edit === true,
      viewOnlyReason: str(o.view_only_reason),
      nights: o.nights.flatMap((n) => { const p = parseNight(n); return p ? [p] : []; }),
    },
  };
}

export type SetResult = { kind: 'ok'; night: RaffleNight | null } | { kind: 'refused'; reason: string; night: RaffleNight | null };

/** organiser_raffle_night_set_v1: ok true, or ok false with a reason (not_authorised, view_only, enabled_required, draft, cancelled, past, locked). */
export function parseSet(data: unknown): SetResult {
  const o = obj(data);
  if (!o) throw new Error('raffle set: unreadable');
  if (o.ok === true) return { kind: 'ok', night: parseNight(o.night) };
  return { kind: 'refused', reason: str(o.reason) ?? 'unknown', night: parseNight(o.night) };
}

/** The night of the Events list in the series read: matched by its date (the list row carries no occurrence id). */
export function nightOnDate(read: RaffleRead, date: string | null): RaffleNight | null {
  if (!date) return null;
  const hits = read.nights.filter((n) => n.date === date);
  return hits.find((n) => n.chip !== 'cancelled') ?? hits[0] ?? null;
}

// ---- The 4-step track ---------------------------------------------------------------------------------------

export const TRACK = ['Open', 'Entries', 'Closed', 'Winner'] as const;

/** Which step of the track is current: -1 = none (no raffle on this night). */
export function stepOf(n: RaffleNight): number {
  switch (n.chip) {
    case 'open': return 0;
    case 'locked': return 1;
    case 'past': return n.entries > 0 ? 2 : -1;
    case 'drawn': return 3;
    default: return -1;
  }
}

/** The short chip on the night sheet row. */
export function chipWord(n: RaffleNight): string {
  switch (n.chip) {
    case 'open': return 'Raffle open';
    case 'locked': return `Raffle locked · ${n.entries}`;
    case 'drawn': return 'Winner drawn';
    case 'closed': return 'Raffle off';
    case 'past': return n.entries > 0 ? `Entries closed · ${n.entries}` : 'No raffle';
    case 'cancelled': return 'No raffle';
    default: return 'No raffle';
  }
}

const pm = (h24: number, m: number): string => `${h24 % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h24 >= 12 ? 'pm' : 'am'}`;

/** "7pm": entries close 2 hours before the start (the default; raffle_cutoff_rules has 0 rows). null when the start is unknown. */
export function closesAt(startLocal: string | null): string | null {
  const m = /T(\d{2}):(\d{2})/.exec(startLocal ?? '');
  if (!m) return null;
  const mins = ((Number(m[1]) * 60 + Number(m[2]) - 120) % 1440 + 1440) % 1440;
  return pm(Math.floor(mins / 60), mins % 60);
}

/** "Fri 13 Nov, 7pm" in London time; null when the instant is unreadable. */
export function drawnLine(iso: string | null): string | null {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return null;
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(t);
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? '';
  return `${g('weekday')} ${g('day')} ${g('month')}, ${g('hour')}${g('minute') === '00' ? '' : `:${g('minute')}`}${g('dayPeriod').toLowerCase()}`;
}

export const entriesWord = (n: number): string => (n === 1 ? '1 entered' : `${n} entered`);

// ---- Status story, gate, button -----------------------------------------------------------------------------

export interface Story { title: string; body: string }

export function story(n: RaffleNight): Story {
  const close = closesAt(n.startLocal);
  switch (n.chip) {
    case 'draft': return { title: 'No raffle yet', body: 'Put the night live first. A raffle lives inside a live night.' };
    case 'cancelled': return { title: 'No raffle', body: 'This night is cancelled, so it has no raffle.' };
    case 'closed': return { title: 'Raffle off', body: 'Dancers see no raffle on this night. Open one and it shows on the night’s event page straight away.' };
    case 'open': return { title: 'Raffle open', body: `Nobody has entered yet. You can still close it${close ? ` until ${close}` : ''}.` };
    case 'locked': return { title: `${entriesWord(n.entries)}, locked`, body: `Once anyone enters, you cannot close it here. Entries close${close ? ` at ${close}` : ' 2 hours before the start'}. To cancel, message us.` };
    case 'past':
      return n.entries > 0
        ? { title: `Entries closed · ${n.entries}`, body: 'We draw the winner from our side and tell them. You will see the winner here once they have picked this night.' }
        : { title: 'No raffle ran', body: 'Nobody entered before it closed, so there is no draw. Nothing to do.' };
    case 'drawn': return { title: 'Winner drawn', body: 'Let them in free on the door.' };
  }
}

export type Action = 'open' | 'close' | 'message' | 'none';

/** The ONE button a night can have right now. `why` is printed under it whenever it is off. */
export interface Gate { action: Action; label: string; enabled: boolean; why: string | null }

export function gate(n: RaffleNight, read: Pick<RaffleRead, 'canEdit' | 'viewOnlyReason'>): Gate {
  const ownerWhy = read.viewOnlyReason ?? 'ask an owner';
  const viewOnly = `You can look but not change it: ${ownerWhy}.`;
  switch (n.chip) {
    case 'draft': return { action: 'none', label: 'Open a raffle', enabled: false, why: 'Put the night live first.' };
    case 'cancelled': return { action: 'none', label: 'Open a raffle', enabled: false, why: 'This night is cancelled.' };
    case 'past': return { action: 'none', label: 'Open a raffle', enabled: false, why: 'This night has passed. Nothing can change.' };
    case 'drawn': return { action: 'none', label: 'Open a raffle', enabled: false, why: 'The winner is drawn. Nothing can change.' };
    case 'locked': return { action: 'message', label: 'Message us to cancel', enabled: true, why: null };
    case 'open': return read.canEdit && n.canSet
      ? { action: 'close', label: 'Close the raffle', enabled: true, why: null }
      : { action: 'close', label: 'Close the raffle', enabled: false, why: read.canEdit ? 'It cannot be closed right now.' : viewOnly };
    case 'closed': return read.canEdit && n.canSet
      ? { action: 'open', label: 'Open a raffle', enabled: true, why: null }
      : { action: 'open', label: 'Open a raffle', enabled: false, why: read.canEdit ? 'It cannot be opened right now.' : viewOnly };
  }
}

export interface Confirm { title: string; body: string[]; go: string; keep: string; danger: boolean }

/** The hard-stop confirmation: never one tap, always a sheet that says what happens. */
export function confirmOf(action: 'open' | 'close', n: RaffleNight): Confirm {
  const close = closesAt(n.startLocal);
  if (action === 'open') {
    return {
      title: 'Open a raffle for this night?',
      body: [
        'It shows on this night’s event page straight away.',
        `Dancers can enter${close ? ` until ${close}, 2 hours before the start` : ' until 2 hours before the start'}.`,
        'Once anyone enters, you cannot close it here. To cancel after that, you message us.',
        'We draw one winner and tell them. You let them in free on the door.',
      ],
      go: 'Open the raffle', keep: 'Not now', danger: false,
    };
  }
  return {
    title: 'Close the raffle?',
    body: ['It comes off this night’s event page now.', `Nobody has entered, so nobody is told. You can open it again${close ? ` until ${close}` : ' until entries close'}.`],
    go: 'Close the raffle', keep: 'Keep it open', danger: true,
  };
}

/** What a refused write says. Nothing was changed in every case. */
export function refusedLine(reason: string): string {
  switch (reason) {
    case 'locked': return 'Someone just entered, so it cannot be closed here now. To cancel, message us. Nothing was changed.';
    case 'past': return 'This night has passed. Nothing was changed.';
    case 'cancelled': return 'This night is cancelled. Nothing was changed.';
    case 'draft': return 'Put the night live first. Nothing was changed.';
    case 'view_only': return 'Only an owner or manager can do this: ask an owner. Nothing was changed.';
    case 'not_authorised': return 'You no longer have access to this night. Nothing was changed.';
    default: return 'Nothing changed. Try again.';
  }
}

/** Reasons that retrying cannot fix (the sheet refreshes the night instead of offering Try again). */
export const FINAL_REFUSALS: ReadonlySet<string> = new Set(['locked', 'past', 'cancelled', 'draft', 'view_only', 'not_authorised']);
