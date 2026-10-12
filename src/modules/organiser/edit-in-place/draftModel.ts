// Edit in place: the local draft, its storage, the card, and the ONE save.
// Pure apart from the injected storage and client.
//
// THE TRAP this module exists for: organiser_profile_update_p5_v1 replaces the
// WHOLE `socials` object, and buildOrganiserProfilePatch sends the whole form.
// So a save is NEVER a hand-built partial patch: the form is formFromEntity()
// of the STORED organiser with the drafted fields laid over it, and the patch
// is buildOrganiserProfilePatch() of that form. Saving only Facebook therefore
// re-sends the stored Instagram and Website in their own columns AND in
// socials, and the server treats every unchanged value as a no-op.
// contact_phone / show_contact_publicly stay undefined (left out of the patch,
// so a stored phone is never blanked and the flag never moves); contact_email
// is never sent (admin-only).
//
// Name lives in the form like the rest. City is NOT a form field: its draft is
// the picked city's id and goes out as the patch's city_id (the second argument
// of buildOrganiserProfilePatch), in the same one call.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOrganiserProfilePatch, saveOrganiserProfile, type OrganiserProfileEditForm } from '@/lib/organiserProfileUpdate';
import { formFromEntity, type ProfileEntity } from '@/modules/organiser/profile/profileForm';
import { CARD_VISIBLE_ROWS, CITY_COPY, FIELD_KEYS, FIELD_LABEL, NAME_COPY, PROMPTED_FIELDS, checkField, isFieldKey, type FieldKey, type PromptedField } from './fieldRules';

export type Drafts = Partial<Record<FieldKey, string>>;

export const draftCount = (d: Drafts): number => Object.keys(d).length;

// ---- the form and the patch -----------------------------------------------------------------

/** The stored organiser's form with every drafted field laid over it. */
export function buildSaveForm(entity: ProfileEntity, drafts: Drafts): OrganiserProfileEditForm {
  const form: OrganiserProfileEditForm = { ...formFromEntity(entity) };
  for (const key of FIELD_KEYS) {
    const v = drafts[key];
    if (v !== undefined && key !== 'city') form[key] = v;
  }
  // Never present: a save must not blank a stored phone or move the contact flag.
  delete form.contact_phone;
  delete form.show_contact_publicly;
  return form;
}

export function buildSavePatch(entity: ProfileEntity, drafts: Drafts): Record<string, unknown> {
  return buildOrganiserProfilePatch(buildSaveForm(entity, drafts), saveCityId(entity, drafts));
}

/** The city the save sends: the picked one, else the stored one. */
const saveCityId = (entity: ProfileEntity, drafts: Drafts): string => drafts.city ?? entity.city_id ?? '';

/** One field's value inside a patch (facebook lives only in socials, city is city_id). */
export function fieldInPatch(patch: Record<string, unknown>, field: FieldKey): unknown {
  if (field === 'city') return patch.city_id ?? null;
  if (field === 'facebook') return ((patch.socials ?? null) as { facebook?: unknown } | null)?.facebook ?? null;
  return patch[field] ?? null;
}

/** The stored value of one field, in patch terms. */
export function storedInPatchTerms(entity: ProfileEntity, field: FieldKey): unknown {
  return fieldInPatch(buildSavePatch(entity, {}), field);
}

/** True when the draft would store exactly what is already stored. */
export function draftMatchesStored(entity: ProfileEntity, field: FieldKey, draft: string): boolean {
  return fieldInPatch(buildSavePatch(entity, { [field]: draft }), field) === storedInPatchTerms(entity, field);
}

/** Drafted fields that would change something. A draft equal to the stored value is dropped. */
export function prunedDrafts(entity: ProfileEntity, drafts: Drafts): Drafts {
  const out: Drafts = {};
  for (const key of FIELD_KEYS) {
    const v = drafts[key];
    if (v !== undefined && !draftMatchesStored(entity, key, v)) out[key] = v;
  }
  return out;
}

/** The page overlay: drafted values shown in place, in the shape the page reads. */
export interface DraftOverlay {
  name?: string;
  city_id?: string | null;
  /** The drafted city's name; null while it is not known yet (never the old city's name). */
  cities?: { name: string; slug: string | null } | null;
  avatar_url?: string | null;
  bio?: string | null;
  instagram?: string | null;
  website?: string | null;
  organisation_category?: string | null;
  founded_year?: number | null;
  socials?: Record<string, string | null | undefined> | null;
}

/** `cityNames`: picked city id -> its name (the sheet resolved it; a restored draft is resolved on load). */
export function overlayFor(entity: ProfileEntity, drafts: Drafts, cityNames: Readonly<Record<string, string>> = {}): DraftOverlay {
  if (draftCount(drafts) === 0) return {};
  const patch = buildSavePatch(entity, drafts);
  const out: DraftOverlay = {};
  const socials: Record<string, string | null | undefined> = { ...((entity.socials ?? {}) as Record<string, string | null | undefined>) };
  let socialsTouched = false;
  for (const key of FIELD_KEYS) {
    if (drafts[key] === undefined) continue;
    const v = fieldInPatch(patch, key);
    if (key === 'city') {
      const id = (v as string | null) ?? null;
      const name = id ? cityNames[id] : undefined;
      out.city_id = id;
      out.cities = name ? { name, slug: null } : null;
    } else if (key === 'name') {
      out.name = String(v ?? '');
    } else if (key === 'facebook') {
      socials.facebook = (v as string | null) ?? null;
      socialsTouched = true;
    } else if (key === 'instagram' || key === 'website') {
      out[key] = (v as string | null) ?? null;
      socials[key] = (v as string | null) ?? null;
      socialsTouched = true;
    } else if (key === 'founded_year') {
      out.founded_year = (v as number | null) ?? null;
    } else {
      out[key] = (v as string | null) ?? null;
    }
  }
  if (socialsTouched) out.socials = socials;
  return out;
}

// ---- the card --------------------------------------------------------------------------------

export interface CardRow extends PromptedField {
  label: string;
  /** Drafted non-empty but not saved: a tick, an 'unsaved' tag and a Change link. */
  drafted: boolean;
}

export interface CardModel {
  /** False once every prompted field is SAVED non-empty (a draft does not count). */
  show: boolean;
  rows: CardRow[];
  /** Rows past CARD_VISIBLE_ROWS, behind "Show more". */
  more: CardRow[];
  done: number;
  total: number;
}

const savedNonEmpty = (entity: ProfileEntity, field: FieldKey): boolean => {
  const v = storedInPatchTerms(entity, field);
  return v !== null && v !== undefined && String(v).trim() !== '';
};

export function cardModel(entity: ProfileEntity, drafts: Drafts, visible = CARD_VISIBLE_ROWS, prompted: readonly PromptedField[] = PROMPTED_FIELDS): CardModel {
  const missing = prompted.filter((p) => !savedNonEmpty(entity, p.key));
  const rows: CardRow[] = missing.map((p) => ({
    ...p,
    label: FIELD_LABEL[p.key],
    drafted: (drafts[p.key] ?? '').trim() !== '',
  }));
  const done = prompted.length - missing.length + rows.filter((r) => r.drafted).length;
  return { show: missing.length > 0, rows: rows.slice(0, visible), more: rows.slice(visible), done, total: prompted.length };
}

// ---- storage (keyed by organiser id; every access may throw) -------------------------------

export const draftStorageKey = (organiserId: string) => `bc:organiser-edit-draft:v1:${organiserId}`;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function readStoredDraft(organiserId: string, storage: StorageLike | null = defaultStorage()): Drafts {
  try {
    const raw = storage?.getItem(draftStorageKey(organiserId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { v?: unknown; fields?: unknown };
    if (parsed?.v !== 1 || !parsed.fields || typeof parsed.fields !== 'object') return {};
    const out: Drafts = {};
    for (const [k, v] of Object.entries(parsed.fields as Record<string, unknown>)) {
      if (isFieldKey(k) && typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeStoredDraft(organiserId: string, drafts: Drafts, storage: StorageLike | null = defaultStorage()): void {
  try {
    if (draftCount(drafts) === 0) storage?.removeItem(draftStorageKey(organiserId));
    else storage?.setItem(draftStorageKey(organiserId), JSON.stringify({ v: 1, fields: drafts }));
  } catch {
    // Private mode, quota, blocked storage: the in-memory draft still works.
  }
}

// ---- the save ---------------------------------------------------------------------------------

export type SaveOutcome =
  | { kind: 'saved'; stored: Partial<Record<FieldKey, unknown>> | null; row: Record<string, unknown> | null; unmatched: FieldKey[] }
  | { kind: 'nothing' }
  /** `fieldError`: copy for the field's own sheet, when the server's reason is about that value (a taken name). */
  | { kind: 'refused'; field: FieldKey | null; message: string; fieldError?: string }
  | { kind: 'network'; message: string };

export const SAVE_COPY = {
  network: 'We could not reach the server. Check your connection and tap Save again. Your changes are kept.',
  generic: 'Your changes were not saved. Tap Save to try again. Your changes are kept.',
  permission: 'Only the owner or a manager of this page can change it. Nothing was saved.',
  signedOut: 'You are signed out. Sign in again, then tap Save. Your changes are kept.',
  nameTaken: 'That name is already used by another organiser, so nothing was saved. Tap Name to pick a different one. Your changes are kept.',
  field: (field: FieldKey) => `${FIELD_LABEL[field]} was not accepted, so nothing was saved. Tap ${FIELD_LABEL[field]} to change it. Your changes are kept.`,
};

/** Which field a server refusal names, from the RPC's error code. */
export function refusedField(code: string, detail: string): FieldKey | null {
  if (code === 'invalid_socials') {
    const sub = detail.trim();
    return sub === 'instagram' || sub === 'website' || sub === 'facebook' ? sub : null;
  }
  if (code === 'invalid_instagram') return 'instagram';
  if (code === 'invalid_website') return 'website';
  if (code === 'invalid_avatar_url') return 'avatar_url';
  if (code === 'founded_year_out_of_range') return 'founded_year';
  if (code.startsWith('bio_')) return 'bio';
  if (code.startsWith('organisation_category_')) return 'organisation_category';
  if (code === 'organiser_name_taken' || code.startsWith('name_')) return 'name';
  if (code === 'city_required' || code === 'city_not_found') return 'city';
  return null;
}

const errorMessage = (e: unknown): string =>
  typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : '';

export function describeSaveError(err: unknown): Extract<SaveOutcome, { kind: 'refused' | 'network' }> {
  const message = errorMessage(err);
  if (!message || /failed to fetch|network|load failed|fetch failed|timeout|aborted/i.test(message)) {
    return { kind: 'network', message: SAVE_COPY.network };
  }
  const [codePart, ...rest] = message.split(':');
  const code = codePart.trim();
  const field = refusedField(code, rest.join(':'));
  if (code === 'organiser_name_taken') return { kind: 'refused', field: 'name', message: SAVE_COPY.nameTaken, fieldError: NAME_COPY.taken };
  if (code === 'city_not_found') return { kind: 'refused', field: 'city', message: SAVE_COPY.field('city'), fieldError: CITY_COPY.notFound };
  if (field) return { kind: 'refused', field, message: SAVE_COPY.field(field) };
  if (code === 'permission_denied') return { kind: 'refused', field: null, message: SAVE_COPY.permission };
  if (code === 'authentication_required') return { kind: 'refused', field: null, message: SAVE_COPY.signedOut };
  return { kind: 'refused', field: null, message: SAVE_COPY.generic };
}

/** The stored values the RPC hands back (its `profile`), in patch terms per field. */
export function storedFromRpcProfile(profile: unknown): Partial<Record<FieldKey, unknown>> | null {
  if (!profile || typeof profile !== 'object') return null;
  const p = profile as Record<string, unknown>;
  const socials = (p.socials ?? null) as { facebook?: unknown } | null;
  return {
    name: p.name ?? null,
    city: p.city_id ?? null,
    avatar_url: p.avatar_url ?? null,
    bio: p.bio ?? null,
    instagram: p.instagram ?? null,
    website: p.website ?? null,
    facebook: socials?.facebook ?? null,
    organisation_category: p.organisation_category ?? null,
    founded_year: p.founded_year ?? null,
  };
}

/**
 * The ONE save: one RPC call for every drafted field. Never throws. A draft that
 * changes nothing sends no command. 'saved' carries the fields whose stored
 * value (the RPC's returned profile) does not match what was sent.
 */
export async function saveDrafts(
  client: Pick<SupabaseClient, 'rpc'>,
  organiserId: string,
  entity: ProfileEntity,
  drafts: Drafts,
): Promise<SaveOutcome> {
  const changed = prunedDrafts(entity, drafts);
  if (draftCount(changed) === 0) return { kind: 'nothing' };
  // Our own checks first: a draft that fails them never reaches the server.
  for (const key of FIELD_KEYS) {
    const v = changed[key];
    if (v !== undefined && !checkField(key, v, { storedCategory: entity.organisation_category }).ok) {
      return { kind: 'refused', field: key, message: SAVE_COPY.field(key) };
    }
  }
  let res: { data: unknown; error: unknown };
  try {
    res = (await saveOrganiserProfile(client, organiserId, buildSaveForm(entity, changed), saveCityId(entity, changed))) as { data: unknown; error: unknown };
  } catch (e) {
    return describeSaveError(e);
  }
  if (res.error) return describeSaveError(res.error);
  const profile = (res.data as { profile?: unknown } | null)?.profile;
  const stored = storedFromRpcProfile(profile);
  const row = stored ? (profile as Record<string, unknown>) : null;
  const sent = buildSavePatch(entity, changed);
  const unmatched = stored
    ? (Object.keys(changed) as FieldKey[]).filter((k) => {
        const a = fieldInPatch(sent, k);
        const b = stored[k] ?? null;
        return String(a ?? '') !== String(b ?? '');
      })
    : [];
  return { kind: 'saved', stored, row, unmatched };
}

/** 'HH:MM' in London, for "Saved at HH:MM". */
export function londonTime(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

/**
 * The confirmation after a save. Honest about freshness: the page HTML is
 * cached by Cloudflare for up to 300 s and nothing purges an organiser page
 * (docs/ops/cloudflare-purge.md), so a visitor can see the old version for a
 * few minutes. The owner's own view is refetched straight from the database.
 */
export const savedMessage = (time: string) => `Saved at ${time}. Visitors may take a few minutes to see it.`;

export const ADDED_MESSAGE = 'Added to your changes. Not saved yet. Tap Save to put it on your page.';

export const restoredMessage = (n: number) =>
  `You have an unsaved draft from earlier. ${n} ${n === 1 ? 'change is' : 'changes are'} not on your page. Save or discard them.`;

export const unsavedBarText = (n: number) => `${n} ${n === 1 ? 'change' : 'changes'} not saved`;
