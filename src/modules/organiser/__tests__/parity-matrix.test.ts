/**
 * PARITY-GAP (c): the organiser parity matrix. One table, PARITY, carries every
 * row of docs/organiser-rebuild/PARITY-GAP.md (66 rows, C01-C71) with the verdict
 * after the P-SERIES fix pass. For each row R1 builds (MATCH / PARTIAL):
 * - its screen is REACHED: the file is in the static import closure of a module
 *   shell/OrganiserRoutes.tsx lazy-imports (a screen no route reaches fails);
 * - every write names the file that sends it, that file is in the screen's
 *   closure and holds the builder token, and the builder's output is exactly
 *   `kind` with exactly `keys`;
 * - the kind is in the prod owner allowlist snapshot (v_owner_kinds) and the keys
 *   in its key snapshot; a write prod refuses today (BROKEN-ON-PROD) must sit
 *   behind the A1 gate;
 * - every `from` link (file, token) is itself reached and holds the token.
 * A bulk write (admin_bulk_occurrence_command_p5) is checked against its own
 * prod kind snapshot. Static reads of the source plus pure builder calls; no
 * render, no network.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  OWNER_CANCEL_KEYS, OWNER_COMMAND_KINDS, OWNER_OVERRIDE_KEYS, OWNER_UPSERT_KEYS,
  addDateCommand, bulkCancelCommand, bulkShiftCommand, cancelCommand, lifecycleCommand, moveDateCommand, overrideCommand,
  resetTimeCommand, setTimeCommand, skipDateCommand, uncancelCommand, unskipDateCommand,
  type BulkCommand, type OwnerCommand,
} from '@/modules/organiser/shared/seriesCommands';
import { dayChangeCommand, detailCommand, endRunCommand, parseEventWorkspace, stopRepeatingCommand, venueCommand, weeklyUntilCommand } from '@/modules/organiser/events/eventModel';
import { endCommand, mediaCommand, pricesCommand } from '@/modules/organiser/events/seriesExtras';
import { coverFixCommands } from '@/modules/organiser/flows/fix/coverModel';
import { dateCommands, liveCommands, timeCommands, venueCommands } from '@/modules/organiser/flows/new/model';

const SRC = resolve(__dirname, '../../..');
const ROOT = resolve(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

// ---- the prod owner snapshot (admin M21:621-659, read 2026-10-17) -----------------------
// A server change must land here by hand; the mirror test below then says which
// client list drifted.
const PROD_OWNER_KINDS = [
  'series.upsert', 'series.add_date', 'series.remove_date', 'occurrence.set_time',
  'series.set_lifecycle', 'occurrence.cancel', 'occurrence.set_override', 'series.skip_date',
  'series.unskip_date', 'series.set_recurrence', 'series.stop_repeating', 'series.end_run',
];
const PROD_UPSERT_KEYS = [
  'name', 'slug', 'default_venue_id', 'default_city_id', 'default_local_start_time',
  'default_duration_minutes', 'default_start_date', 'default_level', 'default_ticket_url',
  'default_description', 'default_cover_image_url', 'default_music_styles', 'default_gallery',
  'default_video_urls', 'timezone', 'category', 'default_passes', 'instagram_url',
];
const PROD_OVERRIDE_KEYS = ['venue_id', 'city_id', 'cancellation_reason_label', 'cover_image_url', 'ticket_url', 'description'];
const PROD_CANCEL_KEYS = ['cancelled', 'reason'];
const PROD_KEYS: Record<string, string[]> = {
  'series.upsert': PROD_UPSERT_KEYS, 'occurrence.set_override': PROD_OVERRIDE_KEYS, 'occurrence.cancel': PROD_CANCEL_KEYS,
};
/** admin_bulk_occurrence_command_p5 kinds and payload keys (prod fn, read 2026-10-17 by P-DATES). */
const PROD_BULK_KEYS: Record<string, string[]> = {
  'occurrence.bulk_cancel': ['occurrence_ids', 'reason'],
  'occurrence.bulk_shift': ['occurrence_ids', 'shift_days'],
};
/** Kinds the client may send only once admin A1 is on prod (D39). */
const A1_KINDS = ['occurrence.move_date'];

// ---- reachability: the static import closure of every routed module ------------------------

const EXT = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
function resolveImport(fromAbs: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(fromAbs), spec) : null;
  if (!base) return null;
  if (/\.(ts|tsx)$/.test(base) && existsSync(base)) return base;
  for (const e of EXT) if (existsSync(base + e)) return base + e;
  return null;
}
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
function closure(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const todo = [...entries];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(IMPORT_RE)) {
      const r = resolveImport(f, m[1]);
      if (r && r.startsWith(SRC) && !seen.has(r)) todo.push(r);
    }
  }
  return seen;
}
const ROUTES_FILE = join(ROOT, 'shell/OrganiserRoutes.tsx');
const ROUTED = [...readFileSync(ROUTES_FILE, 'utf8').matchAll(/import\(\s*'([^']+)'\s*\)/g)]
  .map((m) => resolveImport(ROUTES_FILE, m[1]))
  .filter((f): f is string => !!f);
const REACHED = new Set([...closure(ROUTED)].map((f) => relative(ROOT, f)));
const closureOf = (file: string) => new Set([...closure([join(ROOT, file)])].map((f) => relative(ROOT, f)));

// ---- a workspace as admin_event_workspace_p5 returns it (prod shape) -------------------------

const ws = parseEventWorkspace({
  series: {
    series: {
      id: 's1', name: 'Friday Social', slug: null, format: 'recurring', lifecycle_status: 'live', version: 3,
      default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: 'v0', default_city_id: 'c0',
      default_ticket_url: null, default_cover_image_url: 'https://x/c.jpg', default_duration: null, passes: [],
      default_description: 'Open social', default_level: null, instagram_url: null, default_music_styles: ['Bachata'],
      gallery: ['https://x/g1.jpg'], video_urls: [], recurrence_rule: { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } },
      removed_dates: [],
    },
    program: [],
  },
  occurrences: [{ id: 'o1', occurrence_date: '2026-10-23', lifecycle_status: 'scheduled', version: 1, materialised_start_utc: '2026-10-23T19:00:00Z' }],
  meta: { has_more: false },
});
const PRICE = { id: '0b5c7a8e-5f43-4d6e-9a1b-2c3d4e5f6a7b', name: 'Entry', price: '10', currency: 'GBP' as const };

// ---- the table ----------------------------------------------------------------------------

type Verdict = 'MATCH' | 'PARTIAL' | 'MISSING-ALLOWED' | 'MISSING-ADMIN-ONLY' | 'DROPPED-BY-DECISION';
/** A write: the file that sends it, the token there, and (for owner commands) the builder's output. */
interface Send {
  in: string;
  token: string;
  kind?: string;
  keys?: string[];
  build?: () => OwnerCommand | BulkCommand | null | undefined;
  /** Sent through admin_bulk_occurrence_command_p5, not the owner command RPC. */
  bulk?: boolean;
  /** Prod refuses it today; the file named here must carry the A1 gate. */
  a1Gate?: string;
  /** The screen this write is sent from, when not the row's own (create, the cancel flow). */
  screen?: string;
}
interface Row {
  id: string;
  capability: string;
  verdict: Verdict;
  /** The screen file (module-relative) the capability lives on. */
  screen?: string;
  sends?: Send[];
  /** Read-only facts the screen shows: [file, token], in the screen's closure. */
  shows?: [string, string][];
  /** How an organiser gets there: [file, link token]. */
  from?: [string, string][];
  /** DROPPED: the decision. ADMIN-ONLY: the kind / key the owner allowlist must NOT carry. */
  decision?: string;
  adminKind?: string;
  adminKey?: string;
  /** Copy that must not be in the module (C69). */
  absent?: string;
}

const upsert = (keys: string[], build: Send['build'], file: string, token: string): Send => ({ in: file, token, kind: 'series.upsert', keys, build });
const TO_DETAILS: [string, string][] = [['events/OneEvent.tsx', 'ORG_PATHS.eventDetails']];
const TO_STEP: [string, string][] = [['events/OneEvent.tsx', 'eventStepPath']];
const DETAILS = 'events/Details.tsx';
const ONE = 'events/OneEvent.tsx';
const LINEUP = 'dates/index.tsx';
const SHEET = 'dates/DateSheet.tsx';
const WHAT = 'flows/change/WhatChanges.tsx';
/** Every way to one date's session editor (C59): One event, Change "which date", Change "what". */
const TO_LINEUP: [string, string][] = [[ONE, 'ORG_PATHS.dateLineup'], ['flows/change/WhichDate.tsx', 'ORG_PATHS.dateLineup'], [WHAT, 'ORG_PATHS.dateLineup']];
/** The date editor saves the COMPLETE programme in one call. */
const SAVE_PROGRAMME: Send = { in: 'shared/selfServeApi.ts', token: "programmeRpc('organiser_set_occurrence_programme_v1'" };

export const PARITY: Row[] = [
  { id: 'C01', capability: 'Event name', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name'], () => detailCommand(ws, 'name', 'Saturday Social'), DETAILS, 'detailCommand(')] },
  { id: 'C02', capability: 'About / description', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'default_description'], () => detailCommand(ws, 'about', 'Classes then social'), DETAILS, 'detailCommand(')] },
  { id: 'C03', capability: 'Event type / format', verdict: 'DROPPED-BY-DECISION', decision: 'D54' },
  { id: 'C04', capability: 'Dance / music styles', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'default_music_styles'], () => detailCommand(ws, 'music', 'Bachata, Kizomba'), DETAILS, 'detailCommand(')] },
  { id: 'C05', capability: 'Cover picture', verdict: 'MATCH', screen: 'flows/fix/CoverFlow.tsx',
    from: [[DETAILS, 'ORG_PATHS.cover'], ['jobs/homeJobs.ts', 'ORG_PATHS.cover']],
    sends: [upsert(['default_cover_image_url'], () => coverFixCommands('https://x/n.jpg')[0], 'flows/fix/CoverFlow.tsx', 'coverFixCommands(')] },
  { id: 'C06', capability: 'Gallery photos + video links', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [
      upsert(['name', 'default_gallery'], () => mediaCommand(ws, 'default_gallery', ['https://x/g1.jpg', 'https://x/g2.jpg']), DETAILS, 'mediaCommand('),
      upsert(['name', 'default_video_urls'], () => mediaCommand(ws, 'default_video_urls', ['https://youtu.be/x']), DETAILS, 'mediaCommand('),
    ] },
  { id: 'C07', capability: 'Venue (all dates)', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'default_venue_id', 'default_city_id'], () => venueCommand(ws, 'v1', 'c1'), DETAILS, 'venueCommand(')] },
  { id: 'C08', capability: 'City (from the venue)', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'default_venue_id', 'default_city_id'], () => venueCommand(ws, 'v1', 'c1'), DETAILS, 'venueCommand(')] },
  { id: 'C09a', capability: 'Ticket link', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'default_ticket_url'], () => detailCommand(ws, 'tickets', 'https://tix.example/a'), DETAILS, 'detailCommand(')] },
  // PARTIAL: no quantity (admin-only key on prod, Decision 1); a team-made list is read-only (Decision 2).
  { id: 'C09b', capability: 'Price list (name, price, currency)', verdict: 'PARTIAL', screen: DETAILS, from: [[DETAILS, 'detailEditPath']],
    sends: [upsert(['name', 'default_passes'], () => pricesCommand(ws, [PRICE]), 'events/DetailsExtras.tsx', 'pricesCommand(')] },
  { id: 'C10', capability: 'Instagram link', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'instagram_url'], () => detailCommand(ws, 'instagram', 'https://instagram.com/fridaysocial'), DETAILS, 'detailCommand(')] },
  { id: 'C11', capability: 'Co-organisers on the event', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.set_organisers' },
  { id: 'C12', capability: 'Line-up at series level', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.set_program' },
  { id: 'C13', capability: 'See + edit the sessions inside one date', verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    sends: [SAVE_PROGRAMME], shows: [['shared/selfServeApi.ts', "programmeRpc('organiser_get_occurrence_programme_v1'"], [SHEET, 'label="Type"']] },
  { id: 'C14', capability: 'Usual start / end time', verdict: 'MATCH', screen: DETAILS, from: [[DETAILS, 'detailEditPath']],
    sends: [
      upsert(['name', 'default_local_start_time'], () => detailCommand(ws, 'time', '21:00'), DETAILS, 'detailCommand('),
      upsert(['name', 'default_duration_minutes'], () => endCommand(ws, '23:30'), 'events/DetailsExtras.tsx', 'endCommand('),
    ] },
  { id: 'C15', capability: 'Repeat rule (weekly)', verdict: 'MATCH', screen: ONE, from: TO_STEP,
    sends: [
      { in: 'flows/event/EventStep.tsx', token: 'dayChangeCommand(', kind: 'series.set_recurrence', keys: ['mode', 'weekdays', 'interval', 'end'], build: () => dayChangeCommand(ws.series.recurrence_rule, 3) },
      { in: 'flows/new/model.ts', screen: 'flows/new/NewFlow.tsx', token: 'weeklyRuleCommand(', kind: 'series.set_recurrence', keys: ['mode', 'weekdays', 'end'], build: () => dateCommands('recurring', '2026-10-23')[1] },
    ] },
  { id: 'C16', capability: 'Stop repeating / last date', verdict: 'MATCH', screen: ONE, from: TO_STEP,
    sends: [{ in: 'flows/event/EventStep.tsx', token: 'stopRepeatingCommand(', kind: 'series.stop_repeating', keys: ['keep_occurrence_ids'], build: () => stopRepeatingCommand(['o1']) }] },
  { id: 'C17', capability: 'Add a date', verdict: 'MATCH', screen: 'flows/add/Time.tsx',
    from: [[ONE, 'ORG_PATHS.addEvent'], ['jobs/homeJobs.ts', 'ORG_PATHS.add']],
    sends: [
      { in: 'flows/add/Time.tsx', token: 'addDateCommand(', kind: 'series.add_date', keys: ['date'], build: () => addDateCommand('2026-11-06') },
      { in: 'flows/add/Time.tsx', token: 'setTimeCommand(', kind: 'occurrence.set_time', keys: ['new_local_start', 'new_local_end'], build: () => setTimeCommand('21:00', '02:00') },
    ] },
  { id: 'C18', capability: 'Multi-day festival schedule', verdict: 'DROPPED-BY-DECISION', decision: 'D54' },
  { id: 'C19', capability: 'Change the time of one date', verdict: 'MATCH', screen: 'flows/change/Time.tsx', from: [[WHAT, 'ORG_PATHS.changeTime']],
    sends: [{ in: 'flows/change/Time.tsx', token: 'setTimeCommand(', kind: 'occurrence.set_time', keys: ['new_local_start', 'new_local_end'], build: () => setTimeCommand('21:00', '01:00') }],
    shows: [['flows/change/Time.tsx', 'previewTimes('], ['flows/change/Time.tsx', 'ORG_PATHS.dateLineup']] },
  // PARTIAL until admin A1: prod refuses occurrence.move_date, so the row is hidden and the URL refuses.
  { id: 'C20', capability: 'Move one date to another day', verdict: 'PARTIAL', screen: 'flows/change/Day.tsx', from: [[WHAT, 'ORG_PATHS.changeDay'], [WHAT, 'A1_APPLIED && (']],
    sends: [{ in: 'flows/change/Day.tsx', token: 'moveDateCommand(', kind: 'occurrence.move_date', keys: ['to_date'], build: () => moveDateCommand('2026-10-24'), a1Gate: 'flows/change/Day.tsx' }] },
  { id: 'C21', capability: 'Different venue for one date', verdict: 'MATCH', screen: 'flows/change/Venue.tsx',
    from: [['flows/change/WhatChanges.tsx', 'ORG_PATHS.changeVenue']],
    sends: [{ in: 'flows/change/Venue.tsx', token: 'overrideCommand(', kind: 'occurrence.set_override', keys: ['venue_id', 'city_id'], build: () => overrideCommand({ venue_id: 'v1', city_id: 'c1' }) }] },
  { id: 'C22', capability: 'Line-up (teachers/DJs) of one date', verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    sends: [SAVE_PROGRAMME], shows: [[SHEET, "'Add a teacher'"], [SHEET, "'Add a DJ'"], [SHEET, 'data-testid="session-people"']] },
  { id: 'C23', capability: 'Cancel one date (with reason)', verdict: 'MATCH', screen: 'flows/cancel/Confirm.tsx',
    from: [['flows/cancel/WhichDate.tsx', 'ORG_PATHS.cancelDate'], ['jobs/homeJobs.ts', 'ORG_PATHS.cancel']],
    sends: [{ in: 'flows/cancel/Confirm.tsx', token: 'cancelCommand(', kind: 'occurrence.cancel', keys: ['cancelled', 'reason'], build: () => cancelCommand('Venue closed') }] },
  { id: 'C24', capability: 'Take a date off (break week)', verdict: 'MATCH', screen: 'flows/change/TakeOff.tsx', from: [[WHAT, 'ORG_PATHS.changeOff']],
    sends: [{ in: 'flows/change/TakeOff.tsx', token: 'skipDateCommand(', kind: 'series.skip_date', keys: ['occurrence_id'], build: () => skipDateCommand('o1') }],
    shows: [[WHAT, 'isRuleDate(']] },
  { id: 'C25', capability: 'Put back a cancelled / taken-off date', verdict: 'MATCH', screen: ONE, from: [[ONE, 'putBackPath']],
    sends: [
      { in: 'flows/cancel/Confirm.tsx', screen: 'flows/cancel/Confirm.tsx', token: 'uncancelCommand(', kind: 'occurrence.cancel', keys: ['cancelled'], build: () => uncancelCommand() },
      { in: 'events/takenOff.ts', token: 'unskipDateCommand(', kind: 'series.unskip_date', keys: ['date'], build: () => unskipDateCommand('2026-10-30') },
    ] },
  { id: 'C26', capability: 'Note / picture / ticket link for one date', verdict: 'MATCH', screen: 'flows/change/Detail.tsx', from: [[WHAT, 'ORG_PATHS.changeDetail']],
    sends: [
      { in: 'flows/change/Detail.tsx', token: 'overrideCommand({ [key]: value })', kind: 'occurrence.set_override', keys: ['description'], build: () => overrideCommand({ description: 'Bring water' }) },
      { in: 'flows/change/Detail.tsx', token: 'overrideCommand({ [key]: value })', kind: 'occurrence.set_override', keys: ['ticket_url'], build: () => overrideCommand({ ticket_url: 'https://tix.example/b' }) },
      { in: 'flows/change/Detail.tsx', token: 'overrideCommand({ [key]: value })', kind: 'occurrence.set_override', keys: ['cover_image_url'], build: () => overrideCommand({ cover_image_url: 'https://x/d.jpg' }) },
      { in: 'flows/change/Detail.tsx', token: 'overrideCommand({ [key]: null })', kind: 'occurrence.set_override', keys: ['ticket_url'], build: () => overrideCommand({ ticket_url: null }) },
    ] },
  { id: 'C27', capability: 'Scope: this date / this and future / all', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.apply_forward_from' },
  // PARTIAL until admin A1: an owner's draft -> live is refused on prod, so the wizard saves a draft.
  { id: 'C28a', capability: 'New event goes live from the wizard', verdict: 'PARTIAL', screen: 'flows/new/NewFlow.tsx', from: [['home/index.tsx', 'ORG_PATHS.newWhatFor']],
    sends: [{ in: 'flows/new/model.ts', token: 'liveCommands', kind: 'series.set_lifecycle', keys: ['to'], build: () => liveCommands(true)[0], a1Gate: 'flows/new/model.ts' }] },
  { id: 'C28b', capability: 'Come back to a draft and make it live', verdict: 'PARTIAL', screen: ONE, from: [['jobs/homeJobs.ts', 'ORG_PATHS.event']],
    sends: [{ in: 'events/LifecycleActions.tsx', token: "lifecycleCommand('live')", kind: 'series.set_lifecycle', keys: ['to'], build: () => lifecycleCommand('live'), a1Gate: 'events/lifecycleModel.ts' }] },
  { id: 'C29', capability: 'Pause / resume', verdict: 'MATCH', screen: ONE, from: TO_STEP,
    sends: [{ in: 'flows/event/EventStep.tsx', token: 'lifecycleCommand(', kind: 'series.set_lifecycle', keys: ['to'], build: () => lifecycleCommand('paused') }] },
  { id: 'C30a', capability: 'End the event', verdict: 'MATCH', screen: ONE, from: TO_STEP,
    sends: [{ in: 'flows/event/EndStep.tsx', token: 'endRunCommand(', kind: 'series.end_run', keys: [], build: () => endRunCommand(null) }] },
  { id: 'C30b', capability: 'Discard a draft', verdict: 'MATCH', screen: ONE, from: [['jobs/homeJobs.ts', 'ORG_PATHS.event']],
    sends: [{ in: 'events/LifecycleActions.tsx', token: "lifecycleCommand('archived')", kind: 'series.set_lifecycle', keys: ['to'], build: () => lifecycleCommand('archived') }] },
  { id: 'C31', capability: 'Reopen an ended event', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.restore_ended' },
  { id: 'C32', capability: 'Delete an event', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.delete' },
  { id: 'C33', capability: 'Duplicate / copy an event', verdict: 'DROPPED-BY-DECISION', decision: 'plan 1.6', absent: 'admin_duplicate_event_p5' },
  { id: 'C34', capability: 'Private / unlisted', verdict: 'MISSING-ADMIN-ONLY', adminKey: 'visibility' },
  { id: 'C35', capability: 'Level', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    sends: [upsert(['name', 'default_level'], () => detailCommand(ws, 'level', 'Improvers'), DETAILS, 'detailCommand(')] },
  { id: 'C36a', capability: 'Team: add, change role, remove, hand over', verdict: 'MATCH', screen: 'team/index.tsx',
    from: [['home/homeView.ts', 'ORG_PATHS.team']],
    sends: [{ in: 'shared/teamRpcApi.ts', token: 'organiser_team_set_member_v' }, { in: 'shared/teamRpcApi.ts', token: 'organiser_team_add_member_by_profile_v' }] },
  { id: 'C36b', capability: 'Contributor role', verdict: 'DROPPED-BY-DECISION', decision: 'D41' },
  { id: 'C37', capability: 'Someone-else-changed-it handling', verdict: 'MATCH', screen: DETAILS, from: TO_DETAILS,
    shows: [[DETAILS, 'EventConflict']] },
  { id: 'C38', capability: 'Open the public event page', verdict: 'MATCH', screen: ONE, from: [['jobs/homeJobs.ts', 'ORG_PATHS.event']],
    shows: [['events/lifecycleModel.ts', 'publicEventPath'], ['events/LifecycleActions.tsx', 'seeLive']] },
  { id: 'C39', capability: 'List of dates', verdict: 'MATCH', screen: ONE, from: [['jobs/homeJobs.ts', 'ORG_PATHS.event']],
    shows: [[ONE, 'data-testid="org-coming-date"'], [ONE, 'pastOnly'], ['events/EditorRows.tsx', 'Past dates (']] },
  { id: 'C40', capability: 'One date -> weekly', verdict: 'MATCH', screen: ONE, from: TO_STEP,
    sends: [{ in: 'flows/event/EventStep.tsx', token: 'weeklyUntilCommand(', kind: 'series.set_recurrence', keys: ['mode', 'weekdays', 'end'], build: () => weeklyUntilCommand('2026-10-23', '2026-12-18') }] },
  { id: 'C50', capability: 'Create a new event (wizard)', verdict: 'MATCH', screen: 'flows/new/NewFlow.tsx', from: [['home/index.tsx', 'ORG_PATHS.newWhatFor']],
    sends: [
      upsert(['default_venue_id', 'default_city_id'], () => venueCommands('v1', 'c1')[0], 'flows/new/NewFlow.tsx', 'venueCommands('),
      upsert(['default_start_date'], () => dateCommands('one_off', '2026-10-23')[0], 'flows/new/NewFlow.tsx', 'dateCommands('),
      upsert(['default_local_start_time'], () => timeCommands('20:00')[0], 'flows/new/NewFlow.tsx', 'timeCommands('),
    ] },
  { id: 'C51', capability: 'Course length (N weeks)', verdict: 'MISSING-ADMIN-ONLY', adminKey: 'course_total_sessions' },
  { id: 'C52', capability: "One session's name / type / start / end on one date", verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    sends: [SAVE_PROGRAMME], shows: [[SHEET, 'label="Name"'], [SHEET, 'label="Type"'], [SHEET, 'label="Starts"'], [SHEET, 'label="Ends"']] },
  { id: 'C53', capability: 'Session levels on one date', verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    sends: [SAVE_PROGRAMME], shows: [[SHEET, 'levelsApplyTo(row.type)'], [SHEET, 'testId="session-levels"']] },
  { id: 'C54', capability: 'Add a session to one date', verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    sends: [SAVE_PROGRAMME], shows: [[LINEUP, "newSession('class')"], [LINEUP, 'Add a session']] },
  { id: 'C55', capability: 'Remove a session from one date', verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    sends: [SAVE_PROGRAMME], shows: [[SHEET, 'Remove from this date']] },
  { id: 'C56', capability: 'Session room / rooms list', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.set_rooms' },
  { id: 'C57', capability: 'Whole-series programme', verdict: 'MISSING-ADMIN-ONLY', adminKind: 'series.set_program' },
  { id: 'C58', capability: 'Cancel or shift many dates at once', verdict: 'MATCH', screen: 'flows/change/Pick.tsx', from: [['flows/change/WhichDate.tsx', 'ORG_PATHS.changePick']],
    sends: [
      { in: 'flows/change/Pick.tsx', token: 'bulkCancelCommand(', kind: 'occurrence.bulk_cancel', keys: ['occurrence_ids', 'reason'], bulk: true, build: () => bulkCancelCommand(['o1', 'o2'], 'Venue closed') },
      { in: 'flows/change/Pick.tsx', token: 'bulkShiftCommand(', kind: 'occurrence.bulk_shift', keys: ['occurrence_ids', 'shift_days'], bulk: true, build: () => bulkShiftCommand(['o1'], 7) },
      { in: 'flows/change/bulkApi.ts', token: "rpc('admin_bulk_occurrence_command_p5'" },
    ] },
  { id: 'C59', capability: "Open ANY date's session editor", verdict: 'MATCH', screen: LINEUP, from: TO_LINEUP,
    shows: [['shared/programmeModel.ts', 'NOT_EDITABLE_COPY']] },
  { id: 'C60', capability: "Copy one date's changes from another date", verdict: 'MATCH', screen: 'flows/change/Copy.tsx', from: [[WHAT, 'ORG_PATHS.changeCopy']],
    sends: [
      { in: 'flows/change/Copy.tsx', token: 'overrideCommand({ [p.key]: p.value })', kind: 'occurrence.set_override', keys: ['description'], build: () => overrideCommand({ description: 'Bring water' }) },
      { in: 'flows/change/Copy.tsx', token: 'overrideCommand(await venueOverridePatch(', kind: 'occurrence.set_override', keys: ['venue_id', 'city_id'], build: () => overrideCommand({ venue_id: 'v1', city_id: 'c1' }) },
    ],
    shows: [['flows/change/changeModel.ts', 'export function copyPatches']] },
  // PARTIAL: no read exposes a per-date time change; the start-differs proxy misses an end-only change (P-DATES decision 5).
  { id: 'C61', capability: 'Put a date back to the usual time / details', verdict: 'PARTIAL', screen: 'flows/change/Time.tsx', from: [[WHAT, 'ORG_PATHS.changeTime']],
    sends: [
      { in: 'flows/change/Time.tsx', token: 'resetTimeCommand()', kind: 'occurrence.set_time', keys: ['reset'], build: () => resetTimeCommand() },
      { in: 'flows/change/Detail.tsx', screen: 'flows/change/Detail.tsx', token: 'overrideCommand({ [key]: null })', kind: 'occurrence.set_override', keys: ['description'], build: () => overrideCommand({ description: null }) },
    ],
    shows: [['flows/change/Time.tsx', 'hasOwnTime(']] },
  { id: 'C62', capability: 'Featured flag / promotion log', verdict: 'MISSING-ADMIN-ONLY', adminKey: 'featured' },
  { id: 'C63', capability: 'Review / approval step', verdict: 'DROPPED-BY-DECISION', decision: 'D4' },
  { id: 'C64', capability: 'Undo the last change', verdict: 'DROPPED-BY-DECISION', decision: 'D49' },
  { id: 'C65', capability: 'Pending-changes tray / discard', verdict: 'DROPPED-BY-DECISION', decision: 'D35' },
  { id: 'C66', capability: 'Why a date cannot be edited', verdict: 'MATCH', screen: 'dates/index.tsx', from: [['events/EditorRows.tsx', 'ORG_PATHS.dateLineup']],
    shows: [['shared/programmeModel.ts', 'not_editable_reason']] },
  { id: 'C67', capability: 'Home to-do list', verdict: 'MATCH', screen: 'home/index.tsx', shows: [['jobs/homeJobs.ts', 'export function homeJobs']] },
  { id: 'C68', capability: 'Edit the organiser page', verdict: 'MATCH', screen: 'page/index.tsx', from: [['home/homeView.ts', 'ORG_PATHS.page']],
    sends: [{ in: '../../lib/organiserProfileUpdate.ts', token: 'organiser_profile_update_p5_v1' }] },
  // The Home step is gone (P-SERIES); a WhatsApp field stays admin-only (no column, no update key).
  { id: 'C69', capability: 'Organiser WhatsApp on My page', verdict: 'MISSING-ADMIN-ONLY', absent: 'Show your WhatsApp' },
  { id: 'C70', capability: 'Get a page: claim, ask to join, create', verdict: 'MATCH', screen: 'home/index.tsx',
    sends: [
      { in: 'shared/selfServeApi.ts', token: 'claim_organiser_v1' },
      { in: 'shared/selfServeApi.ts', token: 'request_organiser_access_v1' },
      { in: 'shared/selfServeApi.ts', token: 'create_organiser_profile_v1' },
    ] },
  { id: 'C71', capability: 'Switch page; support contact', verdict: 'MATCH', screen: 'switch/index.tsx', from: [['home/index.tsx', 'ORG_PATHS.switch']] },
];

const isBuilt = (r: Row) => r.verdict === 'MATCH' || r.verdict === 'PARTIAL';
const sortKeys = (o: Record<string, unknown>) => Object.keys(o).sort();
/** Every non-test source file in the module, for the "nowhere sends it" checks. */
const MODULE_FILES = [...REACHED].filter((f) => !f.startsWith('..') && !f.includes('__tests__'));

describe('organiser parity matrix', () => {
  it('carries all 66 PARITY-GAP rows, once each', () => {
    const ids = PARITY.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(66);
  });

  it('the prod owner snapshot matches the client mirror (A1 kinds aside)', () => {
    expect([...OWNER_COMMAND_KINDS].filter((k) => !A1_KINDS.includes(k)).sort()).toEqual([...PROD_OWNER_KINDS].sort());
    expect([...OWNER_UPSERT_KEYS].sort()).toEqual([...PROD_UPSERT_KEYS].sort());
    expect([...OWNER_OVERRIDE_KEYS].sort()).toEqual([...PROD_OVERRIDE_KEYS].sort());
    expect([...OWNER_CANCEL_KEYS].sort()).toEqual([...PROD_CANCEL_KEYS].sort());
  });

  describe.each(PARITY.filter(isBuilt))('$id $capability ($verdict)', (row) => {
    it('its screen is reached from a route in OrganiserRoutes', () => {
      expect(row.screen, 'a built row names its screen').toBeTruthy();
      expect(existsSync(join(ROOT, row.screen!)), `${row.screen} exists`).toBe(true);
      expect(REACHED.has(row.screen!), `${row.screen} is in no routed module's import closure`).toBe(true);
    });

    const sends = row.sends ?? [];
    const shows = row.shows ?? [];
    if (sends.length || shows.length) {
      const where = [...sends.map((s) => [s.in, s.token, s.screen ?? row.screen!]), ...shows.map(([f, t]) => [f, t, row.screen!])];
      it.each(where)('%s holds %s, inside the closure of %s', (file, token, screen) => {
        expect(REACHED.has(screen), `${screen} is in no routed module's import closure`).toBe(true);
        expect(closureOf(screen).has(file), `${file} is not imported (directly or not) by ${screen}`).toBe(true);
        expect(read(file)).toContain(token);
      });
    }

    const owned = sends.filter((s) => s.kind);
    if (owned.length) {
      it.each(owned.map((s) => [s.token, s] as const))('%s builds exactly its kind and keys, all in the prod owner snapshot', (_t, s) => {
        const cmd = s.build?.();
        expect(cmd, 'the builder returns a command for a changed value').toBeTruthy();
        expect(cmd!.kind).toBe(s.kind);
        const payload = cmd!.payload as Record<string, unknown>;
        expect(sortKeys(payload)).toEqual([...s.keys!].sort());
        if (s.bulk) {
          expect(PROD_BULK_KEYS[cmd!.kind], `${cmd!.kind} is not a prod bulk kind`).toBeTruthy();
          expect(sortKeys(payload)).toEqual([...PROD_BULK_KEYS[cmd!.kind]].sort());
          return;
        }
        if (!PROD_OWNER_KINDS.includes(cmd!.kind)) {
          expect(s.a1Gate, `${cmd!.kind} is refused on prod (BROKEN-ON-PROD) and has no A1 gate`).toBeTruthy();
        }
        const allowed = PROD_KEYS[cmd!.kind];
        if (allowed) expect(sortKeys(payload).filter((k) => !allowed.includes(k)), 'keys the prod owner allowlist refuses').toEqual([]);
        if (s.a1Gate) expect(read(s.a1Gate), `${s.a1Gate} gates on A1`).toMatch(/\bA1_APPLIED\b/);
      });
    }

    if (row.from?.length) {
      it.each(row.from)('reachable from %s (%s)', (file, token) => {
        expect(REACHED.has(file), `${file} is in no routed module's import closure`).toBe(true);
        expect(read(file)).toContain(token);
      });
    }
  });

  describe.each(PARITY.filter((r) => r.verdict === 'MISSING-ADMIN-ONLY'))('$id $capability (admin only)', (row) => {
    if (row.adminKind) {
      it(`the owner allowlist has no ${row.adminKind}, and nothing here sends it`, () => {
        expect(PROD_OWNER_KINDS).not.toContain(row.adminKind);
        expect(OWNER_COMMAND_KINDS as readonly string[]).not.toContain(row.adminKind);
        expect(MODULE_FILES.filter((f) => read(f).includes(`'${row.adminKind}'`))).toEqual([]);
      });
    }
    if (row.adminKey) {
      it(`the owner upsert keys have no ${row.adminKey}`, () => {
        expect(PROD_UPSERT_KEYS).not.toContain(row.adminKey);
        expect(OWNER_UPSERT_KEYS as readonly string[]).not.toContain(row.adminKey);
      });
    }
    if (row.absent) {
      it(`no screen says "${row.absent}"`, () => {
        expect(MODULE_FILES.filter((f) => read(f).includes(row.absent!))).toEqual([]);
      });
    }
  });

  describe.each(PARITY.filter((r) => r.verdict === 'DROPPED-BY-DECISION'))('$id $capability (dropped)', (row) => {
    it('names its decision, and a D-number is cited in the module', () => {
      expect(row.decision).toBeTruthy();
      if (/^D\d+$/.test(row.decision!)) {
        const cite = new RegExp(`\\b${row.decision}\\b`);
        expect(MODULE_FILES.some((f) => cite.test(read(f))), `${row.decision} cited nowhere in the module`).toBe(true);
      }
    });
    if (row.absent) {
      it(`nothing here calls ${row.absent}`, () => {
        expect(MODULE_FILES.filter((f) => read(f).includes(row.absent!))).toEqual([]);
      });
    }
  });

  it('no MISSING-ALLOWED row is left (every row the owner may do is built)', () => {
    expect(PARITY.filter((r) => r.verdict === 'MISSING-ALLOWED').map((r) => r.id)).toEqual([]);
  });

  it('the counts: MATCH / PARTIAL / admin-only / dropped, nothing left to fill', () => {
    const count = (v: Verdict) => PARITY.filter((r) => r.verdict === v).length;
    expect({ match: count('MATCH'), partial: count('PARTIAL'), adminOnly: count('MISSING-ADMIN-ONLY'), dropped: count('DROPPED-BY-DECISION') })
      .toEqual({ match: 43, partial: 5, adminOnly: 11, dropped: 7 });
  });
});
