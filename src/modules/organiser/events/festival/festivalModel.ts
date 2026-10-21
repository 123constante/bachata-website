// Festival model (ER-C10). Pure: no React, no network. A festival is a start date,
// a number of nights (each with its own party hours), an OPTIONAL workshop timetable
// and ONE artist list. The programme itself stays the stored tree (programmeSeriesModel):
// this file only reads nights/timetable out of it and writes them back, echoing every
// stored row it was not asked to change, so an untouched save builds the same payload
// (programCommand returns null) and sends nothing.

import { addDaysToKey, londonDateKey } from '@/lib/londonDate';
import { asWallClock, wallClockToInstant } from '@/lib/time/wallClock';
import { festivalDefaultHours, sessionKindRules, toMinutes, validSessionPair, type SessionKind } from '../../shared/eventRules';
import rules from '../../shared/event-rules.json';
import {
  buildDays,
  parseTree,
  treeDirty,
  type PItem,
  type PSection,
  type PTree,
} from '../programmeSeriesModel';
import { newSession, type SessionDraft } from '../../sessions/sessionsModel';
import { setProgramCommand, type OwnerCommand } from '../../shared/seriesCommands';

export { parseTree, type PTree };

export const MIN_DAYS = 1;
/** A festival of more than a fortnight is a typo. */
export const MAX_DAYS = 14;
export const MAX_ARTISTS = 60;

export interface FestivalNight {
  /** Day-row id when stored, else a fresh key. */
  id: string;
  start: string;
  end: string;
  /** The stored party row this night reads (null: none stored, or a new night). */
  partyKey: string | null;
  /** Hours the stored row had (null: nothing stored). */
  stored: { start: string; end: string } | null;
  touched: boolean;
}

export type ArtistRole = 'teacher' | 'dj' | 'performer';
export const ARTIST_ROLES: { role: ArtistRole; label: string }[] = [
  { role: 'teacher', label: 'Teacher' },
  { role: 'dj', label: 'DJ' },
  { role: 'performer', label: 'Performer' },
];
export const roleLabel = (role: ArtistRole): string => ARTIST_ROLES.find((r) => r.role === role)?.label ?? 'Artist';
export interface Artist { personId: string; name: string; role: ArtistRole }

export interface FestivalDraft {
  /** YYYY-MM-DD of the first night. */
  startDate: string;
  ticketUrl: string;
  nights: FestivalNight[];
  /** Workshop timetable per night index (same length as nights); [] = none that day. */
  timetable: SessionDraft[][];
  /** Night indexes whose timetable the person changed. */
  timetableTouched: number[];
  artists: Artist[];
}

let counter = 0;
const nextId = (p: string) => `${p}${Date.now().toString(36)}${(counter += 1).toString(36)}`;

export const defaultHours = (): { start: string; end: string } => ({ start: festivalDefaultHours.start, end: festivalDefaultHours.end });

const newNight = (hours = defaultHours()): FestivalNight => ({ id: nextId('n'), ...hours, partyKey: null, stored: null, touched: true });

/** A brand-new festival: `days` nights, 22:00-04:00 each. */
export function newFestival(startDate: string, days = 3): FestivalDraft {
  const n = clampDays(days);
  return {
    startDate,
    ticketUrl: '',
    nights: Array.from({ length: n }, () => newNight()),
    timetable: Array.from({ length: n }, () => []),
    timetableTouched: [],
    artists: [],
  };
}

export const clampDays = (n: number): number => Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(n) || MIN_DAYS));

// ---- reading a stored festival -------------------------------------------------------

const isParty = (it: PItem): boolean => it.type === 'party';
const partyOf = (tree: PTree, di: number): PItem | null => {
  for (const s of tree.days[di]?.sections ?? []) for (const it of s.items) if (isParty(it)) return it;
  return null;
};

const kindOfItem = (it: PItem): SessionKind => {
  const found = (Object.keys(rules.sessionKinds) as SessionKind[]).find((k) => sessionKindRules(k)?.storedType === it.type);
  return found ?? 'workshop';
};

export const sessionFromItem = (it: PItem): SessionDraft => ({
  ...newSession(kindOfItem(it), it.start || '12:00', it.key),
  name: it.title,
  start: it.start || '12:00',
  end: it.end || it.start || '13:00',
  levels: it.levels as SessionDraft['levels'],
  people: it.people.map((p) => ({ id: p.profileId, name: p.name })),
});

/**
 * The stored programme as a draft. Each programme day is a night (party hours from its
 * first party row); everything else on the day is the workshop timetable, kept as stored.
 */
export function festivalFromStored(input: { startDate: string; ticketUrl?: string | null; tree: PTree; artists?: Artist[] }): FestivalDraft {
  const { tree } = input;
  const days = tree.days.length > 0 ? tree.days.length : 1;
  const nights: FestivalNight[] = [];
  const timetable: SessionDraft[][] = [];
  for (let i = 0; i < days; i += 1) {
    const party = partyOf(tree, i);
    const stored = party && party.start && party.end ? { start: party.start, end: party.end } : null;
    nights.push({
      id: tree.days[i]?.key ?? nextId('n'),
      start: stored?.start ?? festivalDefaultHours.start,
      end: stored?.end ?? festivalDefaultHours.end,
      partyKey: party?.key ?? null,
      stored,
      touched: false,
    });
    timetable.push((tree.days[i]?.sections ?? []).flatMap((s) => s.items).filter((it) => !isParty(it)).map(sessionFromItem));
  }
  return { startDate: input.startDate, ticketUrl: input.ticketUrl ?? '', nights, timetable, timetableTouched: [], artists: input.artists ?? [] };
}

// ---- the nights ----------------------------------------------------------------------

export const nightDate = (d: FestivalDraft, i: number): string => addDaysToKey(d.startDate, i);

const replaceAt = <T,>(list: readonly T[], i: number, v: T): T[] => list.map((x, k) => (k === i ? v : x));

/** Why these hours cannot be saved (end must differ from start; past midnight is fine). */
export function hoursProblem(start: string, end: string): string | null {
  if (toMinutes(start) === null || toMinutes(end) === null) return 'Pick the hours';
  return validSessionPair(start, end).valid ? null : 'End after start';
}

export function setNightHours(d: FestivalDraft, i: number, hours: { start: string; end: string }): FestivalDraft {
  const n = d.nights[i];
  if (!n || (n.start === hours.start && n.end === hours.end)) return d;
  return { ...d, nights: replaceAt(d.nights, i, { ...n, ...hours, touched: true }) };
}

/** "Use these hours every night": copies one night's hours onto the rest. */
export function sameHoursEveryNight(d: FestivalDraft, i: number): FestivalDraft {
  const from = d.nights[i];
  if (!from) return d;
  return d.nights.reduce((acc, _n, k) => (k === i ? acc : setNightHours(acc, k, { start: from.start, end: from.end })), d);
}

export const canAddDay = (d: FestivalDraft): boolean => d.nights.length < MAX_DAYS;
export const canRemoveDay = (d: FestivalDraft): boolean => d.nights.length > MIN_DAYS;
export const addDayReason = (d: FestivalDraft): string | null => (canAddDay(d) ? null : `At most ${MAX_DAYS} days`);
export const removeDayReason = (d: FestivalDraft): string | null => (canRemoveDay(d) ? null : 'A festival needs a day');

/** A new last day takes the hours of the day before it. */
export function addDay(d: FestivalDraft): FestivalDraft {
  if (!canAddDay(d)) return d;
  const last = d.nights[d.nights.length - 1];
  return { ...d, nights: [...d.nights, newNight(last ? { start: last.start, end: last.end } : defaultHours())], timetable: [...d.timetable, []] };
}

/** Removing day i shifts the later days up; their hours and timetable go with them. */
export function removeDay(d: FestivalDraft, i: number): FestivalDraft {
  if (!canRemoveDay(d) || i < 0 || i >= d.nights.length) return d;
  const dropped = d.timetable.length ? d.timetable.filter((_t, k) => k !== i) : [];
  return {
    ...d,
    // The later nights now sit on other stored day rows, so their hours are rewritten too.
    nights: d.nights.filter((_n, k) => k !== i).map((n, k) => (k >= i ? { ...n, touched: true } : n)),
    timetable: dropped,
    // Every day after i now holds different sessions, and the programme is sent whole.
    timetableTouched: Array.from(new Set([...d.timetableTouched.filter((k) => k < i).concat(Array.from({ length: Math.max(0, dropped.length - i) }, (_x, k) => i + k))])),
  };
}

export const setDays = (d: FestivalDraft, n: number): FestivalDraft => {
  let out = d;
  const want = clampDays(n);
  while (out.nights.length < want) out = addDay(out);
  while (out.nights.length > want) out = removeDay(out, out.nights.length - 1);
  return out;
};

/** Moving the first day moves every night with it. */
export function moveStart(d: FestivalDraft, startDate: string): FestivalDraft {
  return /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? { ...d, startDate } : d;
}

// ---- true instants (BST!) --------------------------------------------------------------

/**
 * The true UTC instant of a London wall clock on a night. A start before the rollover
 * hour (08:00) belongs to the NIGHT before, so it falls on the next calendar day.
 */
export function nightInstant(date: string, time: string, nextDay = false): string | null {
  const rolled = toMinutes(time) !== null && (toMinutes(time) as number) < (toMinutes(rules.time.rolloverBefore) as number);
  const key = nextDay || rolled ? addDaysToKey(date, 1) : date;
  const at = wallClockToInstant(asWallClock(`${key}T${time}:00`));
  return at ? at.toISOString() : null;
}

/** Festival `starts_at`: the first night's start, as a TRUE instant. */
export function startsAt(d: FestivalDraft): string | null {
  const n = d.nights[0];
  return n ? nightInstant(d.startDate, n.start) : null;
}

/** Festival `ends_at`: the last night's end (past midnight rolls to the next day). */
export function endsAt(d: FestivalDraft): string | null {
  const i = d.nights.length - 1;
  const n = d.nights[i];
  return n ? nightInstant(nightDate(d, i), n.end, validSessionPair(n.start, n.end).nextDay) : null;
}

// ---- workshop timetable ------------------------------------------------------------------

export const hasTimetable = (d: FestivalDraft): boolean => d.timetable.some((t) => t.length > 0);

const touch = (d: FestivalDraft, i: number): number[] => (d.timetableTouched.includes(i) ? d.timetableTouched : [...d.timetableTouched, i]);

export function setDaySessions(d: FestivalDraft, i: number, sessions: SessionDraft[]): FestivalDraft {
  if (i < 0 || i >= d.nights.length) return d;
  return { ...d, timetable: replaceAt(d.timetable, i, sessions), timetableTouched: touch(d, i) };
}

/** "Copy a day": the sessions of one day, with fresh ids, onto another (replacing what was there). */
export function copyDay(d: FestivalDraft, from: number, to: number): FestivalDraft {
  if (from === to || !d.timetable[from]) return d;
  return setDaySessions(d, to, d.timetable[from].map((s) => ({ ...s, id: nextId('s') })));
}

export const copyTargets = (d: FestivalDraft, from: number): number[] => d.nights.map((_n, k) => k).filter((k) => k !== from);

// ---- artists (ONE list, shown as the line-up) --------------------------------------------

export function addArtist(d: FestivalDraft, a: Artist): FestivalDraft {
  if (d.artists.length >= MAX_ARTISTS || d.artists.some((x) => x.personId === a.personId)) return d;
  return { ...d, artists: [...d.artists, a] };
}
export const removeArtist = (d: FestivalDraft, personId: string): FestivalDraft => ({ ...d, artists: d.artists.filter((a) => a.personId !== personId) });
export const setArtistRole = (d: FestivalDraft, personId: string, role: ArtistRole): FestivalDraft => ({
  ...d,
  artists: d.artists.map((a) => (a.personId === personId ? { ...a, role } : a)),
});
/** The line-up: names in the order added, "Ana (Teacher), Leo (DJ)". */
export const lineupLine = (artists: readonly Artist[]): string => artists.map((a) => `${a.name} (${roleLabel(a.role)})`).join(', ');
export const LINEUP_EMPTY = 'No artists yet. Search for a teacher, DJ or performer to add one.';
export const artistsDirty = (a: readonly Artist[], b: readonly Artist[]): boolean =>
  JSON.stringify(a.map((x) => [x.personId, x.role])) !== JSON.stringify(b.map((x) => [x.personId, x.role]));

// ---- ticket link -------------------------------------------------------------------------

export function ticketProblem(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:' ? null : 'Link must start https://';
  } catch {
    return 'Link must start https://';
  }
}

// ---- writing it back ---------------------------------------------------------------------

/** Echo a stored section untouched; build a minimal new one. */
const blankSection = (kind: string): PSection => ({ key: nextId('sec'), raw: {}, kind, items: [], storedEmpty: false });
const itemFromSession = (s: SessionDraft, existing: PItem | undefined): PItem => ({
  key: existing?.key ?? s.id,
  raw: existing?.raw ?? {},
  type: sessionKindRules(s.kind)?.storedType ?? 'workshop',
  title: s.name,
  start: s.start,
  end: s.end,
  levels: s.levels,
  people: s.people.map((p) => {
    const old = existing?.people.find((x) => x.profileId === p.id);
    return old ?? { profileId: p.id, name: p.name, profileType: 'teacher', role: 'teaching', level: null };
  }),
  added: !existing,
});

/**
 * The programme tree the draft means, built on the stored `original` so every row the
 * person did not touch is echoed. A night that was not touched is not rewritten.
 */
export function toTree(d: FestivalDraft, original: PTree): PTree {
  const days = d.nights.map((n, i) => {
    const base = original.days[i] ?? { key: nextId('d'), raw: {}, sections: [] };
    let sections = base.sections;
    const storedItems = new Map(sections.flatMap((s) => s.items).map((it) => [it.key, it] as const));
    if (n.touched) {
      let placed = false;
      sections = sections.map((s) => ({
        ...s,
        items: s.items.map((it) => {
          if (placed || !isParty(it)) return it;
          placed = true;
          return { ...it, start: n.start, end: n.end };
        }),
      }));
      if (!placed) {
        const party: PItem = itemFromSession({ ...newSession('party', n.start), end: n.end, name: sessionKindRules('party')?.label ?? 'Party' }, undefined);
        const at = sections.findIndex((s) => s.kind === 'party');
        sections = at >= 0 ? sections.map((s, k) => (k === at ? { ...s, items: [...s.items, party] } : s)) : [...sections, { ...blankSection('party'), items: [party] }];
      }
    }
    if (d.timetableTouched.includes(i)) {
      const keep = sections.map((s) => ({ ...s, items: s.items.filter(isParty), storedEmpty: false }));
      for (const s of d.timetable[i] ?? []) {
        const kind = sessionKindRules(s.kind)?.section ?? 'workshops';
        let sec = keep.find((x) => x.kind === kind);
        if (!sec) {
          sec = blankSection(kind);
          keep.push(sec);
        }
        sec.items = [...sec.items, itemFromSession(s, storedItems.get(s.id))];
      }
      sections = keep.filter((s) => s.items.length > 0);
    }
    return { ...base, sections };
  });
  return { days };
}

/** Programme command, or null when nothing changed (an untouched Save sends nothing). */
export function programmeCommand(d: FestivalDraft, original: PTree): OwnerCommand | null {
  const next = toTree(d, original);
  return treeDirty(next, original) ? setProgramCommand(buildDays(next)) : null;
}

export interface FestivalOriginal { startDate: string; ticketUrl: string; tree: PTree; artists: Artist[]; days: number }

export const datesChanged = (d: FestivalDraft, o: FestivalOriginal): boolean => d.startDate !== o.startDate || d.nights.length !== o.days;

/** The series.upsert payload for the basics; null when the date and ticket link are as stored. */
export function basicsCommand(d: FestivalDraft, o: FestivalOriginal): OwnerCommand | null {
  const payload: Record<string, unknown> = {};
  if (d.startDate !== o.startDate) payload.default_start_date = d.startDate;
  if (d.ticketUrl.trim() !== o.ticketUrl.trim()) payload.default_ticket_url = d.ticketUrl.trim() || null;
  return Object.keys(payload).length ? { kind: 'series.upsert', payload } : null;
}

/** Everything a Save sends, in order. Empty = untouched. */
export function festivalCommands(d: FestivalDraft, o: FestivalOriginal): OwnerCommand[] {
  return [basicsCommand(d, o), programmeCommand(d, o.tree)].filter((c): c is OwnerCommand => c !== null);
}

/** Why Save is off, or null. */
export function festivalProblem(d: FestivalDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.startDate)) return 'Pick the first day';
  const link = ticketProblem(d.ticketUrl);
  if (link) return link;
  for (const n of d.nights) {
    const p = hoursProblem(n.start, n.end);
    if (p) return p;
  }
  return null;
}

/** "Update live event" is offered when the live festival's dates changed (moving day one counts). */
export const needsUpdateLive = (d: FestivalDraft, o: FestivalOriginal): boolean => datesChanged(d, o);

export const todayKey = (now = new Date()): string => londonDateKey(now);
