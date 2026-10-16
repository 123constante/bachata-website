import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { DancerApiError, codeFromMessage, toDancerError } from './errors';
import { DANCER_GATE_RPC, backendOverride, fetchGateRaw, type DancerBackend } from './gateRpc';
import { DANCE_ROLES, STRENGTH_STEPS, type DanceRole, type DancerDelta, type DancerGate, type MyDancerEdit, type PublicDancerExtras, type StrengthStep } from './types';

export { setFakeBackend, parseGate, type DancerBackend } from './gateRpc';

/**
 * Typed wrappers for the four dancer-area RPCs (INTERFACE section 5). Screens
 * call these and nothing else; every failure arrives as a DancerApiError whose
 * message is already the copy from api/errors.ts.
 *
 * The backend slot and the raw gate read live in api/gateRpc.ts (kept small:
 * see there). Tests swap the backend with setFakeBackend(createFakeBackend(...)) (see
 * api/fakeBackend.ts and shell/renderInShell.tsx) and go through the SAME
 * wrappers, so a screen test exercises the real parsing and error mapping.
 */
export const DANCER_RPC = {
  gate: DANCER_GATE_RPC,
  myEdit: 'my_dancer_edit_v1',
  save: 'save_my_dancer_profile_v2',
  publicExtras: 'get_public_dancer_extras_v1',
} as const;

const call = async (fn: string, args?: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await rpcLoose(fn, args);
  if (error) {
    // PostgREST passes the DB's DETAIL (the field, for some codes) as `details`.
    const details = (error as { details?: unknown }).details;
    throw new DancerApiError(codeFromMessage(error.message), error.message, typeof details === 'string' ? details : null);
  }
  return data;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/**
 * Review S7: a vocabulary value the client does not know (admin renamed or added one)
 * degrades to the safe default and is logged once per value, never cast through.
 */
const warned = new Set<string>();
const unknownValue = (field: string, value: unknown) => {
  const key = `${field}:${String(value)}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[dancer-app] unknown ${field} from the server: ${JSON.stringify(value)}; using the safe default`);
};
const isStep = (v: unknown): v is StrengthStep => (STRENGTH_STEPS as readonly unknown[]).includes(v);
const isRole = (v: unknown): v is DanceRole => (DANCE_ROLES as readonly unknown[]).includes(v);

const parseRole = (v: unknown): DanceRole | null => {
  if (v === null || v === undefined || v === '') return null;
  if (isRole(v)) return v;
  unknownValue('dance_role', v);
  return null;
};

const parseStep = (v: unknown): StrengthStep | null => {
  if (v === null || v === undefined) return null;
  if (isStep(v)) return v;
  unknownValue('strength.next_step', v);
  return null;
};

const parseSteps = (v: unknown): StrengthStep[] =>
  strings(v).filter((s): s is StrengthStep => {
    if (isStep(s)) return true;
    unknownValue('strength.missing', s);
    return false;
  });

/** my_dancer_edit_v1 / save_my_dancer_profile_v2 -> MyDancerEdit; arrays are never null. */
export const parseMyDancerEdit = (data: unknown): MyDancerEdit => {
  if (!isRecord(data) || typeof data.profile_id !== 'string') {
    throw new DancerApiError('unknown', 'my_dancer_edit_v1 returned an unexpected shape');
  }
  const s = isRecord(data.strength) ? data.strength : {};
  return {
    profile_id: data.profile_id,
    user_id: str(data.user_id) ?? '',
    display_name: str(data.display_name),
    first_name: str(data.first_name),
    surname: str(data.surname),
    hide_surname_publicly: data.hide_surname_publicly === true,
    based_city_id: str(data.based_city_id),
    city_name: str(data.city_name),
    dance_role: parseRole(data.dance_role),
    nationality: str(data.nationality),
    languages: strings(data.languages),
    bio: str(data.bio),
    instagram: str(data.instagram),
    facebook: str(data.facebook),
    website_url: str(data.website_url),
    whatsapp: str(data.whatsapp),
    show_whatsapp_publicly: data.show_whatsapp_publicly !== false,
    avatar_url: str(data.avatar_url),
    dance_started_year: typeof data.dance_started_year === 'number' ? data.dance_started_year : null,
    favorite_styles: strings(data.favorite_styles),
    favorite_songs: strings(data.favorite_songs),
    achievements: strings(data.achievements),
    other_roles: strings(data.other_roles),
    is_active: data.is_active !== false,
    erase_requested_at: str(data.erase_requested_at),
    linked_from_admin: data.linked_from_admin === true,
    complete: data.complete === true,
    strength: {
      pct: typeof s.pct === 'number' ? s.pct : 0,
      next_step: parseStep(s.next_step),
      missing: parseSteps(s.missing),
    },
  };
};

export const parsePublicExtras = (data: unknown): PublicDancerExtras => {
  if (data === null || data === undefined) return null;
  if (!isRecord(data)) throw new DancerApiError('unknown', 'get_public_dancer_extras_v1 returned an unexpected shape');
  return { bio: str(data.bio), languages: strings(data.languages), whatsapp: str(data.whatsapp) };
};

const realBackend: DancerBackend = {
  fetchGate: fetchGateRaw,
  fetchMyDancerEdit: async () => parseMyDancerEdit(await call(DANCER_RPC.myEdit)),
  saveMyDancerProfile: async (delta) => parseMyDancerEdit(await call(DANCER_RPC.save, { p_payload: delta })),
  fetchPublicExtras: async (profileId) => parsePublicExtras(await call(DANCER_RPC.publicExtras, { p_profile_id: profileId })),
};

const backend = (): DancerBackend => backendOverride() ?? realBackend;

const wrap = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    throw toDancerError(err);
  }
};

/** dancer_area_gate_v1. Callers: gate/useDancerArea only (it owns the signed-out rule). */
export const fetchGate = (): Promise<DancerGate> => wrap(() => backend().fetchGate());

/** my_dancer_edit_v1: the signed-in person's own profile, everything the Edit / Home screens show. */
export const fetchMyDancerEdit = (): Promise<MyDancerEdit> => wrap(() => backend().fetchMyDancerEdit());

/** The keys save_my_dancer_profile_v2 refuses (by mere presence) from a person with no other profile type. */
const WHATSAPP_KEYS = ['whatsapp', 'show_whatsapp_publicly'] as const;

/** R6: a person whose other_roles is empty never sends a WhatsApp key (the DB says `whatsapp_not_allowed`). */
export const dropWhatsappIfNotAllowed = (delta: DancerDelta, person: Pick<MyDancerEdit, 'other_roles'>): DancerDelta => {
  if (person.other_roles.length > 0) return delta;
  const out = { ...delta };
  for (const k of WHATSAPP_KEYS) delete out[k];
  return out;
};

/**
 * save_my_dancer_profile_v2: send ONLY the changed keys (absent = leave as is).
 * An empty delta is not sent at all: "saving an untouched record sends nothing".
 * WhatsApp keys are dropped for a person with no other profile type; when the
 * caller did not pass `current` and the delta carries one, the person is read
 * first (my_dancer_edit_v1) to know.
 */
export const saveMyDancerProfile = (delta: DancerDelta, current?: MyDancerEdit): Promise<MyDancerEdit> =>
  wrap(async () => {
    let person = current;
    // Review N1: an empty delta is never sent, with or without `current` (read the person instead).
    if (!person && (Object.keys(delta).length === 0 || WHATSAPP_KEYS.some((k) => k in delta))) person = await backend().fetchMyDancerEdit();
    const send = person ? dropWhatsappIfNotAllowed(delta, person) : delta;
    if (Object.keys(send).length === 0 && person) return person;
    return backend().saveMyDancerProfile(send);
  });

/** get_public_dancer_extras_v1: bio, languages and (only when allowed) WhatsApp for a public page. */
export const fetchPublicExtras = (profileId: string): Promise<PublicDancerExtras> =>
  wrap(() => backend().fetchPublicExtras(profileId));
