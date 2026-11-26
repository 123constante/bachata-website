import {
  addPerson, buildPayload, validateProgramme, type DraftPerson, type DraftSession,
} from '../../shared/programmeModel';
import { fetchOccurrenceProgramme } from '../../shared/selfServeApi';
import { fullDate } from '../../shared/dateWords';
import type { WorkspaceDate } from '../../shared/seriesModel';
import { draftsOf } from '../data/sessions';
import { nightSessionsOff, type WriteStep } from './editorModel';

/** Copy for the "Just this date / This date and all later dates" question (brief #2245). */
export const FWD = {
  title: 'Change the teachers on',
  justThis: 'Just this date',
  allLater: 'This date and all later dates',
  laterCount: (n: number) => `${n} later ${n === 1 ? 'date' : 'dates'}`,
  saving: 'Saving...',
  saved: (k: number) => `Teachers saved on ${k} ${k === 1 ? 'date' : 'dates'}.`,
  skipped: (m: number) => `${m} later ${m === 1 ? 'date doesn’t' : 'dates don’t'} have this class, so ${m === 1 ? 'it' : 'they'} stayed as ${m === 1 ? 'it was' : 'they were'}.`,
};

const live = (row: DraftSession) => (row.people ?? []).filter((p) => !p.removed && p.role === 'teaching');

/** The ids of the people teaching this class (removed ones left out), sorted. */
export const teachersOf = (row: DraftSession): string[] => live(row).map((p) => p.id).sort();

/** True when the set of teachers differs. */
export function teachersChanged(before: DraftSession, after: DraftSession): boolean {
  const a = teachersOf(before);
  const b = teachersOf(after);
  return a.length !== b.length || a.some((id, i) => id !== b[i]);
}

/** Later nights that can take a change: after `from`, not cancelled, not past. Sorted by date. */
export function laterNights(dates: WorkspaceDate[], from: Pick<WorkspaceDate, 'occurrence_date'>, today: string): WorkspaceDate[] {
  return dates
    .filter((d) => d.occurrence_date > from.occurrence_date && nightSessionsOff(d, today, false) === null)
    .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

/** The same class on another night: by series item key, else the first live draft with the same type and start. */
export function matchClass(drafts: DraftSession[], edited: DraftSession): DraftSession | null {
  const isSeries = typeof edited.original?.series_item_id === 'string';
  if (isSeries) return drafts.find((d) => !d.removed && d.key === edited.key) ?? null;
  return drafts.find((d) => !d.removed && d.type === edited.type && d.start.slice(0, 5) === edited.start.slice(0, 5)) ?? null;
}

/** The row with its teachers replaced by the edited row's teachers. DJs and other roles stay as they are. */
export function withTeachers(row: DraftSession, edited: DraftSession): DraftSession {
  const want = new Map(live(edited).map((p) => [p.id, p]));
  let out: DraftSession = {
    ...row,
    people: (row.people ?? []).flatMap((p): DraftPerson[] => {
      if (p.role !== 'teaching') return [p];
      if (want.has(p.id)) return [{ ...p, removed: false }];
      if (p.origin === 'added') return [];
      return [{ ...p, removed: true }];
    }),
  };
  for (const p of want.values()) out = addPerson(out, { id: p.id, name: p.name, role: 'teaching' });
  return out;
}

export interface ForwardResult {
  steps: WriteStep[];
  before: (Record<string, unknown> | null)[];
  changed: number;
  skipped: number;
}

/** One programme step per later night that has the class (read fresh), with its Undo "before". */
export async function buildForward(edited: DraftSession, laterDates: WorkspaceDate[]): Promise<ForwardResult> {
  const out: ForwardResult = { steps: [], before: [], changed: 0, skipped: 0 };
  for (const d of laterDates) {
    try {
      const prog = await fetchOccurrenceProgramme(d.id);
      if (!prog.editable) { out.skipped += 1; continue; }
      const original = draftsOf(prog);
      const hit = matchClass(original, edited);
      if (!hit) { out.skipped += 1; continue; }
      const next = original.map((r) => (r.key === hit.key ? withTeachers(r, edited) : r));
      if (validateProgramme(next).rows.length > 0) { out.skipped += 1; continue; }
      out.steps.push({ part: fullDate(d.occurrence_date), target: 'programme', id: d.id, version: prog.version, command: null, payload: buildPayload(next), order: 2 });
      out.before.push({ payload: buildPayload(original) });
      out.changed += 1;
    } catch {
      out.skipped += 1;
    }
  }
  return out;
}

export const forwardLabel = (k: number, skipped: number) => [FWD.saved(k), skipped > 0 ? FWD.skipped(skipped) : ''].filter(Boolean).join(' ');
