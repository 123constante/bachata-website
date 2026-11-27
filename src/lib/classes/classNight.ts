/**
 * Class-night helpers for the /classes "Two doors" page (SEO arc, owner pick C
 * 2026-11-27). One shared reading of a calendar row's programme, so the row tag,
 * the "Next class" card and the beginner cards never disagree.
 *
 * "Beginners slot" is DERIVED, not a field: the event name or any programme slot
 * title mentions "beginner". There is no structured level on the row.
 */
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';

export interface ProgramSlot {
  start: string;
  title: string;
}

const BEGINNER = /beginner/i;
const HHMM = /^(\d{1,2}):(\d{2})/;

/** meta_data.program as [{start "HH:MM", title}], sorted by start, junk dropped. */
export const programOf = (e: Pick<CalendarEventRow, 'meta_data'>): ProgramSlot[] => {
  const md = e.meta_data as { program?: unknown } | null | undefined;
  const raw = md && Array.isArray(md.program) ? md.program : [];
  const out: ProgramSlot[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const { start, title } = p as { start?: unknown; title?: unknown };
    if (typeof title !== 'string' || !title.trim()) continue;
    const m = typeof start === 'string' ? HHMM.exec(start) : null;
    out.push({ start: m ? `${m[1].padStart(2, '0')}:${m[2]}` : '', title: title.trim() });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
};

export const isBeginnerSlot = (e: Pick<CalendarEventRow, 'name' | 'meta_data'>): boolean =>
  BEGINNER.test(e.name ?? '') || programOf(e).some((s) => BEGINNER.test(s.title));
