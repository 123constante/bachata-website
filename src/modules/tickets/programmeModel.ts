/**
 * The night's programme as shown on the Tickets page (mockups-7). Pure: takes the
 * event's own programme sessions (the same rows the Schedule tile reads), nothing new
 * is typed by anyone. Time order, items without a saved time last as "Time to be
 * confirmed", the plain type when no level is saved, at most four items then a
 * "See full programme" link. Hidden entirely when there is no programme.
 */
export interface ProgrammeSessionInput {
  id: string;
  title: string;
  type: string;
  day: string | null;
  startMins: number | null;
  endMins: number | null;
  levels: readonly string[];
}

export interface ProgrammeItem {
  id: string;
  /** "8:00pm", "9:00pm to 2:00am" or "Time to be confirmed". */
  timeText: string;
  /** "Class · Beginner", "Party" or the organiser's own title for other types. */
  label: string;
  type: string;
}

export interface ProgrammeView {
  items: ProgrammeItem[];
  /** True when more items exist than are shown. */
  hasMore: boolean;
  total: number;
  /** Pseudo-ISO first start / last end for the length chip fallback (duration only). */
  startIso: string | null;
  endIso: string | null;
}

export const MAX_PROGRAMME_ITEMS = 4;
export const TIME_TBC = 'Time to be confirmed';

export function fmtMins(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(mm).padStart(2, '0')}${h24 < 12 ? 'am' : 'pm'}`;
}

const TYPE_LABEL: Record<string, string> = {
  class: 'Class',
  masterclass: 'Masterclass',
  workshop: 'Workshop',
  bootcamp: 'Bootcamp',
  party: 'Party',
  performance: 'Performance',
  show: 'Show',
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  improver: 'Improver',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  open_level: 'Open level',
};

const LEVELLED = new Set(['class', 'masterclass', 'workshop', 'bootcamp']);

export function itemLabel(s: Pick<ProgrammeSessionInput, 'title' | 'type' | 'levels'>): string {
  const type = TYPE_LABEL[s.type] ?? (s.title.trim() || 'Session');
  if (!LEVELLED.has(s.type)) return type;
  const levels = s.levels.map((l) => LEVEL_LABEL[l]).filter(Boolean);
  return levels.length > 0 ? `${type} · ${levels.join(', ')}` : type;
}

export function timeText(startMins: number | null, endMins: number | null): string {
  if (startMins === null) return TIME_TBC;
  if (endMins === null || endMins === startMins) return fmtMins(startMins);
  return `${fmtMins(startMins)} to ${fmtMins(endMins)}`;
}

const pseudoIso = (mins: number) => new Date(Date.UTC(2000, 0, 1) + mins * 60000).toISOString();

export function buildProgramme(sessions: readonly ProgrammeSessionInput[] | null | undefined): ProgrammeView | null {
  const list = sessions ?? [];
  if (list.length === 0) return null;
  const indexed = list.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => {
    const ta = a.s.startMins;
    const tb = b.s.startMins;
    if (ta === null && tb === null) return a.i - b.i;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb || a.i - b.i;
  });
  const all: ProgrammeItem[] = indexed.map(({ s }) => ({
    id: s.id,
    timeText: timeText(s.startMins, s.endMins),
    label: itemLabel(s),
    type: s.type,
  }));
  const timed = list.filter((s) => s.startMins !== null);
  let startIso: string | null = null;
  let endIso: string | null = null;
  if (timed.length > 0) {
    const first = Math.min(...timed.map((s) => s.startMins as number));
    // An end before its start crosses midnight: push it a day on.
    const ends = timed
      .filter((s) => s.endMins !== null)
      .map((s) => ((s.endMins as number) <= (s.startMins as number) ? (s.endMins as number) + 1440 : (s.endMins as number)));
    if (ends.length > 0) {
      startIso = pseudoIso(first);
      endIso = pseudoIso(Math.max(...ends));
    }
  }
  return {
    items: all.slice(0, MAX_PROGRAMME_ITEMS),
    hasMore: all.length > MAX_PROGRAMME_ITEMS,
    total: all.length,
    startIso,
    endIso,
  };
}
