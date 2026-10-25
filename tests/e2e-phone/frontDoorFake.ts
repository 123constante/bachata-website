import type { Page, Route } from '@playwright/test';
import { fakeSupabase } from './helpers';

/**
 * The S4 front-door screens (/admin/organisers/front-door) on the phone fake: an ADMIN
 * session (admin_is_admin -> true) and scripted answers for the six front-door RPCs, in
 * the shapes src/modules/admin-organisers/frontDoorApi.ts parses. Registered AFTER
 * fakeSupabase(), so these routes win; everything else still goes to the shared fake and
 * no request leaves the machine. The add / send / run-by-us writes are answered here only,
 * from the scenario, and every call is recorded so a spec can assert what was (not) sent.
 */

export type Failure = 'error' | 'network' | 'hang';
export type Rpcs = {
  list?: unknown[] | Failure;
  needs?: unknown[] | Failure;
  add?: Record<string, unknown> | Failure;
  send?: Record<string, unknown> | Failure;
  runByUs?: Record<string, unknown> | Failure;
  resolve?: Record<string, unknown> | Failure;
};

const RPC_OF: Record<string, keyof Rpcs> = {
  admin_list_organisers_front_door_v1: 'list',
  admin_needs_you_v1: 'needs',
  admin_add_organiser_v1: 'add',
  admin_send_organiser_invite_v1: 'send',
  admin_set_run_by_us_v1: 'runByUs',
  admin_resolve_claim_v1: 'resolve',
};

export interface Call { name: string; args: Record<string, unknown> }

export async function asAdmin(page: Page, rpcs: Rpcs): Promise<Call[]> {
  const calls: Call[] = [];
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
  await page.route(/\/rest\/v1\/rpc\/(admin_[a-z_0-9]+)/, (route: Route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() as string;
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(route.request().postData() || '{}'); } catch { /* no body */ }
    if (name === 'admin_is_admin') return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    const key = RPC_OF[name];
    if (!key) return route.fallback();
    calls.push({ name, args });
    const a = rpcs[key];
    if (a === undefined) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(key === 'list' || key === 'needs' ? { items: [] } : { success: false, code: 'UNKNOWN' }) });
    if (a === 'hang') return; // never answered: the loading state stays up
    if (a === 'network') return route.abort('internetdisconnected');
    if (a === 'error') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: 'boom', details: null, hint: null }) });
    const body = Array.isArray(a) ? { items: a } : a;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

// ---- Organisers list shapes ---------------------------------------------------------------------

let n = 0;
const uuid = () => `f0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
export const row = (name: string | null, chip: string, invite_status = 'none', invite_requested = false, events_published_count = 0) =>
  ({ organiser_id: uuid(), name, chip, invite_status, invite_requested, events_published_count });

/** The owner's phone, 2026-10-25, real data: All 48 = Run by us 42, Invited 0, Joined 2, Live 4. */
const PROD_RBU_NAMES = [
  'Agapi Musicality Dance Project', 'Bachata Sensual Camden', 'Bachata Sunday Socials', 'Bailamos Brixton', 'Caliente Nights',
  'Crouch End Bachata', 'Dance Fusion Hackney', 'Dominican Bachata Club', 'El Ritmo Latino', 'Fiesta Fridays',
  'Havana Social', 'Islington Latin Nights', 'Kizomba and Bachata Mix', 'La Clave', 'Latin Collective',
  'Latin Quarter Soho', 'Luna Bachata', 'Mambo City', 'Marylebone Socials', 'Movimiento',
  'Notting Hill Bachata', 'Pasion Latina', 'Pura Vida Dance', 'Rhythm and Soul', 'Ritmo Caliente',
  'Salsa Fever', 'Salsateca', 'Salsa Rebels', 'Sensual Steps', 'Shoreditch Socials',
  'Sol y Luna', 'Sparkle Up', 'Stockwell Dance Hub', 'Sueno Latino', 'The Bachata Room',
  'The Latin Lounge', 'Tropicana', 'Twist and Turn', 'Vamos Bachata', 'Viva Dance Studio',
  'Wimbledon Latin', 'Zona Latina',
];
export const PROD_LIST = [
  row('a2b Dance Academy', 'live', 'none', false, 12),
  row('Bachata Fusion London', 'live', 'sent', false, 4),
  row('Latin Motion', 'live', 'none', false, 7),
  row('Ritmo Phone QA', 'live', 'none', false, 2),
  row('Barrio Bachata', 'joined'),
  row('Dance Base Social', 'joined', 'sent'),
  ...PROD_RBU_NAMES.map((name) => row(name, 'run_by_us')),
].sort((a, b) => String(a.name).localeCompare(String(b.name)));

export const ONE_ROW = [row('Agapi Musicality Dance Project', 'run_by_us')];
export const MANY_ROWS = Array.from({ length: 150 }, (_, i) =>
  row(`Organiser ${String(i + 1).padStart(3, '0')}`, ['run_by_us', 'invited', 'joined', 'live'][i % 4], i % 4 === 1 ? 'queued' : 'none'));
export const LONG_NAMES = [
  row('The Extraordinarily Long Named International Bachata and Kizomba Social Dance Academy of North London', 'run_by_us'),
  row('Supercalifragilisticexpialidociousbachatasocialclubwithoutanyspacesatall', 'invited', 'queued'),
  row(null, 'joined'),
  row('   ', 'live', 'none', false, 3),
];
/** Every invite status on every chip, plus the requested twin of queued. */
export const STATUS_MATRIX = ['run_by_us', 'invited', 'joined', 'live'].flatMap((chip) => [
  ...['none', 'queued', 'sent', 'failed', 'skipped'].map((st) => row(`${chip} / ${st}`, chip, st)),
  row(`${chip} / queued, requested`, chip, 'queued', true),
]);

// ---- Needs you shapes ---------------------------------------------------------------------------

const need = (reason: string, label: string | null, extra: Record<string, unknown> = {}) =>
  ({ id: uuid(), reason, organiser_id: uuid(), label, detail: null, since: '2026-09-20T10:00:00Z', next_actions: [], ...extra });

const QUIET_NAMES = ['Tropicana', 'Sparkle Up', 'Salsateca', 'Crouch End Bachata', ...PROD_RBU_NAMES.filter((x) => !['Tropicana', 'Sparkle Up', 'Salsateca', 'Crouch End Bachata'].includes(x))].slice(0, 23);
/** The owner's phone, 2026-10-25: badge 23, one group "Quiet for 30 days (23)". */
export const PROD_NEEDS = QUIET_NAMES.map((name) => need('quiet_30_days', name));
export const EVERY_GROUP = [
  need('email_mismatch_claim', 'Bachata Fusion London', { detail: 'Signed in as ana.ruiz@gmail.example; the page has hello@bachatafusion.example', next_actions: ['approve_full', 'decline'] }),
  need('email_mismatch_claim', 'The Extraordinarily Long Named International Bachata and Kizomba Social Dance Academy', { detail: 'Signed in as averyveryveryverylongemailaddresswithoutbreaks@example.example', next_actions: ['approve_full', 'decline'] }),
  need('join_request', 'Barrio Bachata', { detail: 'Marta Lopez asked to join as a team member' }),
  need('access_request', 'Latin Motion', { detail: null }),
  need('quiet_30_days', 'Tropicana'),
  need('quiet_30_days', null, { organiser_id: null }),
];

// ---- Add answers --------------------------------------------------------------------------------

const ORG = 'f1000000-0000-4000-8000-000000000001';
export const ADD_OK = {
  invite_queued: { success: true, organiser_id: ORG, run_by_us: false, invite_queued: true, person_reused: false, warnings: [] },
  run_by_us: { success: true, organiser_id: ORG, run_by_us: true, invite_queued: false, person_reused: false, warnings: [] },
  no_email: { success: true, organiser_id: ORG, run_by_us: false, invite_queued: false, person_reused: false, warnings: [] },
  already_exists: { success: true, organiser_id: ORG, already_exists: true, run_by_us: false, invite_queued: false },
  person_reused: { success: true, organiser_id: ORG, run_by_us: false, invite_queued: true, person_reused: true, warnings: [] },
  email_has_login: { success: true, organiser_id: ORG, run_by_us: false, invite_queued: true, person_reused: true, warnings: ['email_has_login'] },
} as const;
export const addError = (code: string, field: string | null) => ({ success: false, code, errors: field ? [{ code, field }] : [] });
