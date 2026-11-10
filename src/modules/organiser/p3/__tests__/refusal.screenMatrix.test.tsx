/**
 * Screen x refusal: what each P3 screen that sends a command shows for each
 * refusal the LIVE doors send (prod read 2026-11-05, see
 * scripts/p3-refusal-codes.json and docs/handover-p3-real-rules-check.md).
 *
 * Each row drives the SAME mapping the screen calls (named in `via`) with the
 * server's refusal, and where the defect is in how the screen wires that copy
 * (no gate sheet, a reason hidden behind a condition), a source assertion on
 * the screen file. Not a DOM render: the 390x844 walk stays in WALKLIST.
 *
 * Red first (2026-11-05, unfixed code): F-10, F-11, F-15, F-46. Those rows
 * are in KNOWN_GAPS (shrink-only: a gap row that now passes is red, delete it),
 * so main stays green and each fix deletes its line.
 * F-40 (banned account): no live door raises a ban refusal (prod: the only
 * "banned" text in public functions is the auth.users banned_until column), so
 * there is no row to build. Recorded, not faked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMAND_COPY, commandErrorMessage, ONBOARDING_REFUSAL, teamErrorMessage } from '../../shared/selfServeErrors';
import { reasonMessage } from '../../tickets/ticketModel';
import { RESULT_COPY } from '../new/model';
import { declinedNextLine } from '../../home/onboarding/onboardingModel';

const ROOT = path.resolve(__dirname, '../../../../..');
const src = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const GENERIC = commandErrorMessage({ message: '\u0000no-such-code', code: 'P0001' });
const CATCH_ALL = COMMAND_COPY.find((c) => String(c.match) === '/^permission_denied/')?.message;
const DEAD = /That did not work|Something went wrong/i;
const BLAMES_CONNECTION = /check your connection|offline/i;

interface Row { id: string; fix?: string; screen: string; via: string; check: () => void }

const ownReason = (copy: string) => {
  expect(copy.trim()).not.toBe('');
  expect(copy).not.toBe(GENERIC);
  expect(copy).not.toBe(CATCH_ALL);
  expect(copy).not.toMatch(DEAD);
};
const refusal = (message: string) => ({ message, code: 'P0001' });

const ROWS: Row[] = [
  // Command doors (apply_aggregate_write_p5): Details, Prices, DateSheet, StatusSheet, RepeatSheet all render commandErrorMessage.
  { id: 'details:slug_admin_only', screen: 'DetailsScreen', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('permission_denied: slug_admin_only: series.upsert slug is admin-only'))) },
  { id: 'prices:occurrence_cancelled', screen: 'PricesScreen', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('permission_denied: occurrence_cancelled: occurrence.set_override passes on a cancelled date are admin-only'))) },
  { id: 'date:date_taken', screen: 'DateSheet', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('invalid_transition: date_taken: X'))) },
  { id: 'date:has_bookings', screen: 'DateSheet', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('has_bookings: X'))) },
  { id: 'status:today_session_required', screen: 'StatusSheet', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('invalid_payload: today_session_required: X'))) },
  { id: 'status:cancel_one_off_past', screen: 'CancelEventSheet', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('invalid_transition: cancel_one_off_past: X'))) },
  { id: 'repeat:date_cap', screen: 'RepeatSheet', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage(refusal('permission_denied: date_cap: X'))) },
  { id: 'any:authentication_required (42501)', screen: 'every command screen', via: 'commandErrorMessage', check: () => ownReason(commandErrorMessage({ message: 'authentication_required', code: '42501' })) },

  // F-10: the first-event create sends the command but shows the onboarding refusal as a fixed line: no gate sheet, no way to act.
  { id: 'new:onboarding_incomplete has a way to act', fix: 'F-10', screen: 'NewFlow (flows/new)', via: 'commandErrorMessage, no gated()', check: () => {
    expect(commandErrorMessage(refusal('onboarding_incomplete: X'))).toBe(ONBOARDING_REFUSAL);
    expect(src('src/modules/organiser/flows/new/NewFlow.tsx')).toMatch(/gated\(|GateSheet/);
  } },
  { id: 'create:onboarding_incomplete opens the gate sheet', screen: 'CreateFlow (p3/new)', via: 'useCreateSave gated()', check: () => {
    expect(src('src/modules/organiser/p3/new/useCreateSave.ts')).toMatch(/gated\(/);
  } },

  // F-15: a refused Discard that is not the gate shows "check your connection": the wrong reason.
  { id: 'create:discard refused says why', fix: 'F-15', screen: 'CreateFlow (p3/new)', via: 'RESULT_COPY.discardFailed', check: () => {
    expect(RESULT_COPY.discardFailed).not.toMatch(BLAMES_CONNECTION);
  } },

  // F-11: tickets TypeSheet -> ticket_type_upsert_v1 / ticket_type_set_status_v1 return {ok:false, reason}; live reasons read 2026-11-05.
  ...['capacity_below_reserved', 'closed', 'has_orders', 'immutable_field', 'invalid_capacity', 'invalid_name', 'invalid_payload', 'invalid_price', 'invalid_sales_window', 'occurrence_not_in_series', 'series_not_live_or_not_organisers', 'at_capacity', 'bad_transition', 'organiser_not_onboarded', 'series_not_live']
    .map((r): Row => ({ id: `tickets:${r}`, screen: 'tickets TypeSheet', via: 'reasonMessage', check: () => ownReason(reasonMessage(r)) })),
  ...['not_found', 'not_authorised'].map((r): Row => ({ id: `tickets:${r}`, screen: 'tickets TypeSheet', via: 'reasonMessage', check: () => ownReason(reasonMessage(r)) })),
  // F-11: a refusal the ticket door THROWS (set_status .catch -> reason null; TypeSheet.tsx:131) reaches reasonMessage(null).
  { id: 'tickets:thrown refusal says why', fix: 'F-11', screen: 'tickets TypeSheet', via: 'reasonMessage(null)', check: () => ownReason(reasonMessage(null)) },

  // Team doors (remove_organiser_member_v1, redeem_organiser_invite_v1, claim_my_organisers_v1).
  ...['last_owner', 'cannot_remove_owner', 'not_a_member', 'not_authorised']
    .map((c): Row => ({ id: `team:${c}`, screen: 'Organisers/Team', via: 'teamErrorMessage', check: () => ownReason(teamErrorMessage(refusal(c))) })),

  // F-46: a refused join request. The reason card is gated on !orgId, so the person who asked from a page link gets a silent Welcome.
  { id: 'join:declined says what to do', screen: 'onboarding / join', via: 'declinedNextLine', check: () => { ownReason(declinedNextLine('2026-12-12')); ownReason(declinedNextLine(null)); expect(declinedNextLine(null)).not.toMatch(/ask again/i); expect(declinedNextLine('2026-12-12')).toMatch(/ask again from \w+day \d{1,2} \w+/); } },
  { id: 'join:declined shows with a page in hand', fix: 'F-46', screen: 'onboarding / join', via: 'OnboardingFlow declined card', check: () => {
    expect(src('src/modules/organiser/p3/onboarding/OnboardingFlow.tsx')).not.toMatch(/!orgId && declined\.length > 0/);
  } },
];

/** Shrink-only: rows red on main today. Each fix slice deletes its line. */
const KNOWN_GAPS = [
  'new:onboarding_incomplete has a way to act',
  'create:discard refused says why',
  'tickets:thrown refusal says why',
  'join:declined shows with a page in hand',
];

const passes = (r: Row) => { try { r.check(); return true; } catch { return false; } };

describe('P3 screen x live refusal', () => {
  it.each(ROWS.filter((r) => !KNOWN_GAPS.includes(r.id)).map((r) => [`${r.screen} | ${r.id} (${r.via})`, r] as const))('%s', (_n, r) => {
    r.check();
  });

  it('KNOWN_GAPS is shrink-only: every gap names a row that still fails', () => {
    const ids = new Set(ROWS.map((r) => r.id));
    expect(KNOWN_GAPS.filter((g) => !ids.has(g))).toEqual([]);
    expect(ROWS.filter((r) => KNOWN_GAPS.includes(r.id) && passes(r)).map((r) => r.id)).toEqual([]);
  });

  it('every FIXLIST row this brief aims at is either a gap or proven fixed', () => {
    const fixes = new Set(ROWS.filter((r) => r.fix).map((r) => r.fix));
    expect([...fixes].sort()).toEqual(['F-10', 'F-11', 'F-15', 'F-46']);
  });
});
