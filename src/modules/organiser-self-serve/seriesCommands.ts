// The command envelopes the organiser's series page sends (Lever 2 W4/W5).
// Pure: no client import, so the unit spec can pin the exact JSON.
//
// The Website calls the SAME P5 command RPCs as the admin editor
// (series_command_p5 / occurrence_command_p5 → apply_aggregate_write_p5);
// there is no second save path. A non-admin caller is held to an owner
// allowlist on the server (admin migration
// 20261108180000_p5_owner_allowlist_recurring_create_v1.sql, the
// v_owner_kinds / v_owner_upsert_keys / v_owner_override_keys /
// v_owner_cancel_keys constants). The lists below MIRROR those constants:
// a builder here can only emit a key the server admits for an owner, and the
// spec pins both the mirror and every builder's output against it.

export const OWNER_COMMAND_KINDS = [
  'series.upsert', 'series.add_date', 'series.remove_date', 'occurrence.set_time',
  'series.set_lifecycle', 'occurrence.cancel', 'occurrence.set_override', 'series.skip_date',
  'series.unskip_date', 'series.set_recurrence', 'series.stop_repeating', 'series.end_run',
] as const;

/** series.upsert keys an owner may send on an EXISTING series. */
export const OWNER_UPSERT_KEYS = [
  'name', 'slug', 'default_venue_id', 'default_city_id', 'default_local_start_time',
  'default_duration_minutes', 'default_start_date', 'default_level', 'default_ticket_url',
  'default_description', 'default_cover_image_url', 'default_music_styles', 'default_gallery',
  'default_video_urls', 'timezone',
] as const;

/** occurrence.set_override keys an owner may send (one date's own changes). */
export const OWNER_OVERRIDE_KEYS = [
  'venue_id', 'city_id', 'cancellation_reason_label', 'cover_image_url', 'ticket_url', 'description',
] as const;

export const OWNER_CANCEL_KEYS = ['cancelled', 'reason'] as const;

export type OwnerCommandKind = (typeof OWNER_COMMAND_KINDS)[number];
export type OwnerUpsertKey = (typeof OWNER_UPSERT_KEYS)[number];
export type OwnerOverrideKey = (typeof OWNER_OVERRIDE_KEYS)[number];

export interface OwnerCommand {
  kind: OwnerCommandKind;
  payload: Record<string, unknown>;
}

export interface CommandEnvelope {
  target_id: string;
  /** The row version the screen was showing: a stale save refuses with version_conflict. */
  expected_version?: number;
  idempotency_key: string;
  command: OwnerCommand;
}

export const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

export function envelope(targetId: string, version: number | null | undefined, command: OwnerCommand, key = newIdempotencyKey()): CommandEnvelope {
  return {
    target_id: targetId,
    ...(typeof version === 'number' && version > 0 ? { expected_version: version } : {}),
    idempotency_key: key,
    command,
  };
}

// ---- series basics (W4) --------------------------------------------------------

/** The basics form. Times are London wall-clock HH:MM, never converted. */
export interface BasicsDraft {
  name: string;
  description: string;
  venueId: string | null;
  startTime: string;
  /** Minutes; null when the form has no end time. */
  durationMinutes: number | null;
  level: string;
  ticketUrl: string;
  coverImageUrl: string;
}

const FIELD_KEY: Record<Exclude<keyof BasicsDraft, 'name'>, OwnerUpsertKey> = {
  description: 'default_description',
  venueId: 'default_venue_id',
  startTime: 'default_local_start_time',
  durationMinutes: 'default_duration_minutes',
  level: 'default_level',
  ticketUrl: 'default_ticket_url',
  coverImageUrl: 'default_cover_image_url',
};

/**
 * series.upsert payload for the basics form: `name` always (the handler
 * requires it on every upsert) plus ONLY the fields the organiser changed.
 * The handler is presence-gated (`CASE WHEN p_payload ? key`), so an absent
 * key keeps what the series has, and a field the form does not touch can
 * never be cleared by a save. Blank text clears (the handler NULLIFs '').
 */
export function basicsPayload(initial: BasicsDraft, draft: BasicsDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: draft.name.trim() };
  (Object.keys(FIELD_KEY) as Array<keyof typeof FIELD_KEY>).forEach((field) => {
    const before = initial[field];
    const after = draft[field];
    const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
    if (norm(before) === norm(after)) return;
    // A venue cannot be cleared from here, and a removed end time leaves the duration alone.
    if (field === 'venueId' && !after) return;
    if (field === 'durationMinutes' && after == null) return;
    payload[FIELD_KEY[field]] = typeof after === 'string' ? after.trim() : after;
  });
  return payload;
}

export const hasBasicsChanges = (initial: BasicsDraft, draft: BasicsDraft) =>
  Object.keys(basicsPayload(initial, draft)).length > 1 || draft.name.trim() !== initial.name.trim();

export const upsertCommand = (payload: Record<string, unknown>): OwnerCommand => ({ kind: 'series.upsert', payload });

// ---- the date list (W4) --------------------------------------------------------

export const addDateCommand = (date: string): OwnerCommand => ({ kind: 'series.add_date', payload: { date } });
export const removeDateCommand = (occurrenceId: string): OwnerCommand => ({ kind: 'series.remove_date', payload: { occurrence_id: occurrenceId } });
export const skipDateCommand = (occurrenceId: string): OwnerCommand => ({ kind: 'series.skip_date', payload: { occurrence_id: occurrenceId } });
export const unskipDateCommand = (date: string): OwnerCommand => ({ kind: 'series.unskip_date', payload: { date } });
export const lifecycleCommand = (to: 'paused' | 'live' | 'archived' | 'pending_review'): OwnerCommand => ({ kind: 'series.set_lifecycle', payload: { to } });
/** Send a draft or returned series for review (W6; _owner_lifecycle_transition_allowed_p5 admits draft|rejected -> pending_review). */
export const submitForReviewCommand = (): OwnerCommand => lifecycleCommand('pending_review');

// ---- one date (W5) -------------------------------------------------------------

/** Cancel with a reason that is a cancellation_reasons label (required for owners). */
export const cancelCommand = (reason: string): OwnerCommand => ({ kind: 'occurrence.cancel', payload: { cancelled: true, reason } });
export const uncancelCommand = (): OwnerCommand => ({ kind: 'occurrence.cancel', payload: { cancelled: false } });

/** London wall-clock HH:MM digits, sent as typed; an empty end lets the server keep the length. */
export const setTimeCommand = (start: string, end: string | null): OwnerCommand => ({
  kind: 'occurrence.set_time',
  payload: { new_local_start: start, new_local_end: end && end.trim() ? end : null },
});
export const resetTimeCommand = (): OwnerCommand => ({ kind: 'occurrence.set_time', payload: { reset: true } });

/** One date's own changes. `null` for a key = back to the series. */
export type OverridePatch = Partial<Record<OwnerOverrideKey, string | null>>;

/** occurrence.set_override, filtered to the owner keys; refuses to build an empty patch. */
export function overrideCommand(patch: OverridePatch): OwnerCommand {
  const payload: Record<string, string | null> = {};
  for (const key of OWNER_OVERRIDE_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    payload[key] = typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  if (Object.keys(payload).length === 0) throw new Error('overrideCommand: empty patch');
  return { kind: 'occurrence.set_override', payload };
}
