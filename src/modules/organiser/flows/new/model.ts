import { addDaysToKey } from '@/lib/londonDate';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { weekdayOf } from '@/modules/organiser/shared/createModel';
import {
  createDraftPayload, lifecycleCommand, upsertCommand, weeklyRuleCommand, type OwnerCommand, type OwnerFormat,
} from '@/modules/organiser/shared/seriesCommands';
import { createSeriesCommand } from '@/modules/organiser/shared/selfServeApi';
import type { NewEventFormat } from '@/modules/organiser/shell/paths';
import {
  EVENT_RULES, blockers as ruleBlockers, formatPaymentMethods, paymentCodes, sessionKindRules,
  type Blocker, type PaymentCode, type RuleSeries,
} from '@/modules/organiser/shared/eventRules';
import { linkProblem } from '@/modules/organiser/shared/linkRules';
import { searchRole, type SessionDraft } from '@/modules/organiser/sessions/sessionsModel';
import { A1_APPLIED } from '@/modules/organiser/shared/a1Gate';
import type { GoLiveCheck } from './goLiveCheck';

/**
 * New event (rebuild, ER-C7). Pure: every screen sends exactly the command(s) built here,
 * so a table test pins each step to its command kind. No start-time step, no category:
 * the start comes from the first session (rule 1) and the category is derived by the server.
 */

/**
 * Formats the screen offers. The server's owner create accepts `one_off` and `recurring` only
 * (ER-INTERFACE, AS BUILT; D54 keeps a festival out of owner create), so a Course is listed OFF with its reason; a festival starts in
 * its own flow (ER-C10), not here.
 */
export const NEW_FORMATS: ReadonlyArray<{ format: NewEventFormat | 'course'; label: string; off: string | null }> = [
  { format: 'recurring', label: 'Weekly night', off: null },
  { format: 'one_off', label: 'One-off night', off: null },
  { format: 'course', label: 'Course', off: 'Not available yet' },
];

export function parseFormat(raw: string | null | undefined): NewEventFormat | null {
  return raw === 'recurring' || raw === 'one_off' ? raw : null;
}

/** The ONE shared mapping from a format to the words shown on the review and the preview. */
export const FORMAT_WORDS: Record<string, string> = { recurring: 'Weekly', one_off: 'One-off', course: 'Course', festival: 'Festival' };

/** The one create. The organiser key is attached by createSeriesCommand. */
export const draftCommand = (name: string, format: OwnerFormat, organiserId: string): OwnerCommand =>
  createSeriesCommand(createDraftPayload(name, format), organiserId);

/** ONE upsert. The city rides along when known (a series with no city cannot go live). */
export const venueCommands = (venueId: string, cityId: string | null): OwnerCommand[] => [
  upsertCommand({ default_venue_id: venueId, ...(cityId ? { default_city_id: cityId } : {}) }),
];

/** ONE upsert; a weekly night then ONE set_recurrence on that weekday (D55). A one-off sends nothing more. */
export function dateCommands(format: NewEventFormat, date: string): OwnerCommand[] {
  const first = upsertCommand({ default_start_date: date });
  return format === 'recurring' ? [first, weeklyRuleCommand(weekdayOf(date))] : [first];
}

/** ONE upsert (the picture is already uploaded). */
export const coverCommands = (url: string): OwnerCommand[] => [upsertCommand({ default_cover_image_url: url })];

/** The next 30 days from today, soonest first. */
export function firstDateChoices(today: string, days = 30): Array<{ date: string; label: string }> {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysToKey(today, i);
    return { date, label: dayLabel(date) };
  });
}

// ---- sessions -----------------------------------------------------------------------

/** What the first-session step opens with: ONE party at 21:00, valid as it stands (a class would need a level first). The organiser edits it; there is no time step. */
export const DEFAULT_FIRST_START = '21:00';
export const DEFAULT_FIRST_KIND = 'party' as const;

/**
 * The COMPLETE programme of the first date for organiser_set_occurrence_programme_v1: a draft's
 * date has no stored sessions, so every session goes as a new one, in time order.
 */
export function sessionsWire(sessions: readonly SessionDraft[]): Array<Record<string, unknown>> {
  return sessions.map((s) => {
    const kind = sessionKindRules(s.kind);
    const crosses = s.end <= s.start;
    return {
      new: true,
      type: kind?.storedType ?? s.kind,
      title: s.name.trim(),
      start_time: s.start,
      end_time: s.end,
      ends_next_day: crosses,
      level_keys: kind?.levelAllowed ? s.levels : [],
      ...(s.people.length ? { people_add: s.people.map((p) => ({ profile_id: p.id, role: searchRole(s.kind) })) } : {}),
    };
  });
}

/** Going back to this step after a save: the stored sessions are marked removed and the new list added, so nothing doubles. */
export function replaceProgramme(existing: ReadonlyArray<Record<string, unknown>>, sessions: readonly SessionDraft[]): Array<Record<string, unknown>> {
  return [...existing.filter((o) => o.removed !== true).map((o) => ({ ...o, removed: true })), ...existing.filter((o) => o.removed === true), ...sessionsWire(sessions)];
}

/** A stored session as the rules read it (kind from the stored type, times HH:MM). */
export function ruleSessionsOf(wire: ReadonlyArray<Record<string, unknown>>): Array<{ kind: string | null; start: string | null; end: string | null }> {
  const hhmm = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 5) : null);
  return wire
    .filter((s) => s.removed !== true)
    .map((s) => ({ kind: typeof s.type === 'string' ? s.type : null, start: hhmm(s.start_time), end: hhmm(s.end_time) }));
}

// ---- the last screen: flyer, how to pay, details -------------------------------------

export interface FinishForm {
  payment: PaymentCode[];
  ticketUrl: string;
  description: string;
}

export const emptyFinish = (): FinishForm => ({ payment: [], ticketUrl: '', description: '' });

export function togglePayment(form: FinishForm, code: PaymentCode): FinishForm {
  const on = form.payment.includes(code);
  const payment = on ? form.payment.filter((c) => c !== code) : [...form.payment, code];
  return { ...form, payment, ticketUrl: code === 'ticket_link' && on ? '' : form.ticketUrl };
}

/** Why the ticket link cannot be saved yet (plain words); null when fine or not used. */
export function ticketLinkProblem(form: FinishForm): string | null {
  if (!form.payment.includes('ticket_link')) return null;
  if (!form.ticketUrl.trim()) return 'Ticket link needed';
  return linkProblem('ticket', form.ticketUrl) ? 'Link must start with https://' : null;
}

/**
 * The upsert for what the last screen holds, or [] when the person touched nothing
 * (rule: saving an untouched draft sends no command). `touched` is false until a field changes.
 */
export function finishCommands(form: FinishForm, touched: boolean): OwnerCommand[] {
  if (!touched) return [];
  const payload: Record<string, unknown> = {};
  if (form.payment.length) payload.payment_methods = formatPaymentMethods(form.payment);
  if (form.payment.includes('ticket_link') && form.ticketUrl.trim()) payload.default_ticket_url = form.ticketUrl.trim();
  if (form.description.trim()) payload.default_description = form.description.trim();
  return Object.keys(payload).length ? [upsertCommand(payload)] : [];
}

/** Publish = live at once (rule 6). `a1` is the old admin-A1 gate, kept so the parity matrix can still pin it. */
export const liveCommands = (a1 = A1_APPLIED): OwnerCommand[] => (a1 ? [lifecycleCommand('live')] : []);

// ---- blockers: the LOCAL rules and the SERVER check, both ---------------------------------

export const FLYER_NEEDED = 'Flyer needed';

/** The server codes (ER-INTERFACE section 2 + the existing `cover`) in the words the local rules use. */
const SERVER_REASON: Record<string, string> = {
  no_session_first_date: EVENT_RULES.blockers.session,
  first_date_past: EVENT_RULES.blockers.dateInPast,
  bad_session_times: EVENT_RULES.blockers.sessionTimes,
  no_payment: EVENT_RULES.blockers.payment,
  no_flyer: FLYER_NEEDED,
  cover: FLYER_NEEDED,
};

/** A code the screen does not know yet reads as its own words, never silently dropped. */
export function serverReason(code: string): string {
  const known = SERVER_REASON[code];
  if (known) return known;
  const words = code.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Not ready';
}

export interface FinishInput {
  series: RuleSeries;
  hasFlyer: boolean;
  form: FinishForm;
  /** The server check as last read; null before it has been read. */
  server: GoLiveCheck | null;
}

/** Every reason Publish is off, local first then any the server adds, no repeats. Order: the rules' own. */
export function publishReasons({ series, hasFlyer, form, server }: FinishInput): string[] {
  const local: Blocker[] = ruleBlockers(series);
  const out: string[] = local.map((b) => b.reason);
  if (!hasFlyer) out.push(FLYER_NEEDED);
  const link = ticketLinkProblem(form);
  if (link) out.push(link);
  for (const b of server?.blockers ?? []) out.push(serverReason(b.code));
  return out.filter((r, i) => out.indexOf(r) === i);
}

/** Why the Publish button is off: the first reason, or null when it can go. */
export const publishBlock = (input: FinishInput): string | null => publishReasons(input)[0] ?? null;

export const paymentChoices = (format: string | null): PaymentCode[] => paymentCodes(format);

// ---- small text ---------------------------------------------------------------------

export const nameBlock = (name: string): string | null => (name.trim() ? null : 'Type a name to go on.');

/** "Live - Friday 23 October". */
export const liveMessage = (date: string | null): string => (date ? `Live - ${dayLabel(date)}` : 'Live');
export const DRAFT_SAVED_MESSAGE = 'Saved as a draft.';

/** The question on each step. */
export const STEP_TITLE = {
  what: 'What are you listing?',
  name: 'What is it called?',
  venue: 'Where is it?',
  date: 'When is the first one?',
  session: 'What happens that night?',
  finish: 'Flyer and how to pay',
} as const;
