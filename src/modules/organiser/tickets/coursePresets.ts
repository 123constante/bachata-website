import { isoToLondonInput, londonInputToIso } from './ticketModel';
import { MAX_STEPS, STEPS_FREE, STEPS_FULL, timeDoesNotExist, type PriceStep, type StepForm } from './priceSteps';

/**
 * T5 (docs/briefs/ticket-t5-course-presets.md): a course is a ticket type with a start and an end
 * date, and early-bird presets are SUGGESTED price-change times for it. A preset only fills the
 * T3 form as an unsaved draft; the organiser sets the price and saves it through the T3 path.
 * Pure: the screens and the tests read this one mapping. The server still decides (step_in_past).
 */

export const COURSE_KIND_LABEL = 'A course';
export const NIGHT_KIND_LABEL = 'Each night';
export const COURSE_START_LABEL = 'Course starts';
export const COURSE_END_LABEL = 'Course ends';
export const COURSE_HELP = 'One ticket for the whole course, from the start date to the end date.';
export const COURSE_START_REQUIRED = 'Pick the day the course starts.';
export const COURSE_END_REQUIRED = 'Pick the day the course ends.';
export const COURSE_END_BEFORE_START = 'The course cannot end before it starts.';
export const PRESETS_TITLE = 'Early-bird presets';
export const PRESETS_HELP = 'Tap one to fill in the date. Then enter the price from that date and save it.';
export const PRESETS_FREE = `No presets: ${STEPS_FREE}`;
export const PRESETS_FULL = `No presets: ${STEPS_FULL}`;
export const PRESETS_UNSAVED = 'Save this course first, then you can pick an early-bird preset.';
export const PRESET_PAST = 'That date has passed.';
export const PRESET_TAKEN = 'A price change already starts that day.';

/** The weeks before the start at which the early-bird price ends. */
export const PRESET_WEEKS = [4, 2, 1] as const;

export interface CourseDates {
  kind: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export const parseCourseDates = (r: unknown): CourseDates => {
  const d = (r ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
  return { kind: typeof d.kind === 'string' ? d.kind : null, validFrom: s(d.valid_from), validTo: s(d.valid_to) };
};

export const courseErrors = (f: { validFrom?: string; validTo?: string }): { validFrom?: string; validTo?: string } => {
  const e: { validFrom?: string; validTo?: string } = {};
  const ok = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!ok(f.validFrom)) e.validFrom = COURSE_START_REQUIRED;
  if (!ok(f.validTo)) e.validTo = COURSE_END_REQUIRED;
  else if (ok(f.validFrom) && f.validTo! < f.validFrom!) e.validTo = COURSE_END_BEFORE_START;
  return e;
};

/** 'YYYY-MM-DD' minus whole days, on the calendar (no clock, so no DST drift). */
export const shiftDay = (day: string, days: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export interface Preset {
  id: string;
  weeks: number;
  label: string;
  /** 'YYYY-MM-DDTHH:mm' London, the T3 form's own format. */
  at: string;
}
export interface PresetsView {
  /** A reason for offering none at all (free, full), else null. */
  blocked: string | null;
  offered: Preset[];
  /** Presets left out, each with why. */
  skipped: { id: string; label: string; why: string }[];
}

const labelOf = (w: number) => `Early bird ends ${w} ${w === 1 ? 'week' : 'weeks'} before the start`;

/** Midnight London on the day: never inside a spring gap (01:00-02:00) or an autumn repeat. */
const AT_TIME = '00:00';

export const coursePresets = (c: {
  kind: string | null;
  validFrom: string | null;
  basePricePence: number;
  steps: readonly Pick<PriceStep, 'effectiveFrom'>[];
  now?: Date;
}): PresetsView | null => {
  if (c.kind !== 'course' || !c.validFrom) return null;
  if (c.basePricePence <= 0) return { blocked: PRESETS_FREE, offered: [], skipped: [] };
  if (c.steps.length >= MAX_STEPS) return { blocked: PRESETS_FULL, offered: [], skipped: [] };
  const now = (c.now ?? new Date()).getTime();
  const taken = new Set(c.steps.map((s) => new Date(s.effectiveFrom).getTime()));
  const offered: Preset[] = [];
  const skipped: PresetsView['skipped'] = [];
  for (const w of PRESET_WEEKS) {
    const at = `${shiftDay(c.validFrom, -7 * w)}T${AT_TIME}`;
    const id = `weeks-${w}`;
    const label = labelOf(w);
    const iso = londonInputToIso(at);
    if (!iso || timeDoesNotExist(at) || isoToLondonInput(iso) === '') skipped.push({ id, label, why: PRESET_PAST });
    else if (new Date(iso).getTime() <= now) skipped.push({ id, label, why: PRESET_PAST });
    else if (taken.has(new Date(iso).getTime())) skipped.push({ id, label, why: PRESET_TAKEN });
    else offered.push({ id, weeks: w, label, at });
  }
  return { blocked: null, offered, skipped };
};

/** The unsaved draft a preset puts in the T3 form: the time only; the organiser enters the price. */
export const presetForm = (p: Preset): StepForm => ({ at: p.at, price: '' });
