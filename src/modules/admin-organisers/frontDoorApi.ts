import { supabase } from '@/integrations/supabase/client';

// The S4 front-door RPCs (admin repo PR #1007) are not in the generated Database type until
// they are applied and a bot regenerates it, so they go through one string-named boundary.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export const FRONT_DOOR_LIST_KEY = ['admin-front-door-list'] as const;
export const NEEDS_YOU_KEY = ['admin-needs-you'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

async function call(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

// ---- Add organiser ---------------------------------------------------------------------------

export interface AddOrganiserInput {
  organiserName: string;
  contactName: string;
  contactEmail: string;
  cityId: string;
  runByUs: boolean;
}

export type AddField = 'organiser_name' | 'contact_name' | 'contact_email' | 'city_id' | null;

export type AddResult =
  | { kind: 'created'; organiserId: string; personReused: boolean; inviteQueued: boolean; runByUs: boolean; warnings: string[] }
  | { kind: 'already_exists'; organiserId: string; runByUs: boolean; inviteQueued: boolean }
  | { kind: 'error'; code: string; field: AddField };

export function parseAddResult(data: unknown): AddResult {
  if (!isObj(data)) return { kind: 'error', code: 'INVALID_PAYLOAD', field: null };
  if (data.success === true && str(data.organiser_id)) {
    const organiserId = data.organiser_id as string;
    const runByUs = data.run_by_us === true;
    const inviteQueued = data.invite_queued === true;
    if (data.already_exists === true) return { kind: 'already_exists', organiserId, runByUs, inviteQueued };
    const warnings = Array.isArray(data.warnings) ? data.warnings.filter((w): w is string => typeof w === 'string') : [];
    return { kind: 'created', organiserId, personReused: data.person_reused === true, inviteQueued, runByUs, warnings };
  }
  const first = Array.isArray(data.errors) && isObj(data.errors[0]) ? data.errors[0] : null;
  const code = str(data.code) ?? (first ? str(first.code) : null) ?? 'INVALID_PAYLOAD';
  const field = first ? (str(first.field) as AddField) : null;
  return { kind: 'error', code, field };
}

export async function addOrganiser(input: AddOrganiserInput): Promise<AddResult> {
  const email = input.contactEmail.trim();
  const payload: Record<string, unknown> = {
    organiser_name: input.organiserName.trim(),
    contact_name: input.contactName.trim(),
    city_id: input.cityId,
    run_by_us: input.runByUs,
  };
  if (email && !input.runByUs) payload.contact_email = email;
  return parseAddResult(await call('admin_add_organiser_v1', { p_payload: payload }));
}

// ---- Organisers list -------------------------------------------------------------------------

export type Chip = 'run_by_us' | 'invited' | 'joined' | 'live';
export const CHIPS: readonly Chip[] = ['run_by_us', 'invited', 'joined', 'live'];
export type InviteStatus = 'none' | 'queued' | 'sent' | 'failed' | 'skipped';

export interface FrontDoorRow {
  organiserId: string;
  name: string;
  chip: Chip;
  inviteStatus: InviteStatus;
  inviteRequested: boolean;
  publishedCount: number;
}

export function parseFrontDoorList(data: unknown): FrontDoorRow[] {
  const items = isObj(data) && Array.isArray(data.items) ? data.items : [];
  const out: FrontDoorRow[] = [];
  for (const i of items) {
    if (!isObj(i)) continue;
    const id = str(i.organiser_id);
    const chip = CHIPS.find((c) => c === i.chip);
    if (!id || !chip) continue;
    const st = (['none', 'queued', 'sent', 'failed', 'skipped'] as const).find((s) => s === i.invite_status) ?? 'none';
    out.push({
      organiserId: id,
      name: str(i.name) ?? 'Unnamed organiser',
      chip,
      inviteStatus: st,
      inviteRequested: i.invite_requested === true,
      publishedCount: typeof i.events_published_count === 'number' ? i.events_published_count : 0,
    });
  }
  return out;
}

export const fetchFrontDoorList = async () => parseFrontDoorList(await call('admin_list_organisers_front_door_v1'));

export type SendResult =
  | { kind: 'ok'; alreadyRequested: boolean; alreadySent: boolean; retried: boolean }
  | { kind: 'error'; code: string };

export function parseSendResult(data: unknown): SendResult {
  if (!isObj(data)) return { kind: 'error', code: 'UNKNOWN' };
  if (data.success === true) {
    return { kind: 'ok', alreadyRequested: data.already_requested === true, alreadySent: data.already_sent === true, retried: data.retried === true };
  }
  return { kind: 'error', code: str(data.code) ?? 'UNKNOWN' };
}
export const sendOrganiserInvite = async (organiserId: string) =>
  parseSendResult(await call('admin_send_organiser_invite_v1', { p_organiser_id: organiserId }));

export type RunByUsResult = { kind: 'ok'; runByUs: boolean; changed: boolean } | { kind: 'error'; code: string };
export function parseRunByUsResult(data: unknown): RunByUsResult {
  if (!isObj(data)) return { kind: 'error', code: 'UNKNOWN' };
  if (data.success === true) return { kind: 'ok', runByUs: data.run_by_us === true, changed: data.changed === true };
  return { kind: 'error', code: str(data.code) ?? 'UNKNOWN' };
}
export const setRunByUs = async (organiserId: string, value: boolean) =>
  parseRunByUsResult(await call('admin_set_run_by_us_v1', { p_organiser_id: organiserId, p_value: value }));

// ---- Needs you -------------------------------------------------------------------------------

export type NeedsReason = 'email_mismatch_claim' | 'join_request' | 'access_request' | 'quiet_30_days';
export const NEEDS_REASONS: readonly NeedsReason[] = ['email_mismatch_claim', 'join_request', 'access_request', 'quiet_30_days'];

export interface NeedsItem {
  id: string;
  reason: NeedsReason;
  organiserId: string | null;
  label: string;
  detail: string | null;
  since: string | null;
  nextActions: string[];
}

export function parseNeedsYou(data: unknown): NeedsItem[] {
  const items = isObj(data) && Array.isArray(data.items) ? data.items : [];
  const out: NeedsItem[] = [];
  for (const i of items) {
    if (!isObj(i)) continue;
    const id = str(i.id);
    const reason = NEEDS_REASONS.find((r) => r === i.reason);
    if (!id || !reason) continue;
    out.push({
      id,
      reason,
      organiserId: str(i.organiser_id),
      label: str(i.label) ?? 'Unnamed organiser',
      detail: str(i.detail),
      since: str(i.since),
      nextActions: Array.isArray(i.next_actions) ? i.next_actions.filter((a): a is string => typeof a === 'string') : [],
    });
  }
  return out;
}
export const fetchNeedsYou = async () => parseNeedsYou(await call('admin_needs_you_v1'));

export type Decision = 'approve_full' | 'decline';
export type ResolveResult = { kind: 'ok'; decision: Decision } | { kind: 'error'; code: string };
export function parseResolveResult(data: unknown, decision: Decision): ResolveResult {
  if (!isObj(data)) return { kind: 'error', code: 'UNKNOWN' };
  if (data.success === true) return { kind: 'ok', decision };
  return { kind: 'error', code: str(data.code) ?? 'UNKNOWN' };
}
export const resolveClaim = async (itemId: string, decision: Decision) =>
  parseResolveResult(await call('admin_resolve_claim_v1', { p_item_id: itemId, p_decision: decision }), decision);
