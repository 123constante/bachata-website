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
  // D39 (admin A1): apply_aggregate_write_p5 gains the move arm.
  'occurrence.move_date',
  // ER AD4 (admin 20261204180000): a one-off ends with a reason (cancels its one date; the series stays live).
  'series.cancel_one_off',
] as const;

/**
 * series.upsert keys an owner may send on an EXISTING series (a mirror of the
 * server allowlist, pinned key for key by the mirror test). `category` is a
 * SERVER-ONLY entry here: the server keeps it so an older client is never
 * refused, but it DERIVES category from the sessions and ignores a sent value
 * (event-truth P2), so this client never sends it (upsertCommand strips it).
 * `default_passes` (the price list) and `instagram_url` joined with admin D8
 * (20261109180000_p5_owner_writes_time_price_instagram_v1.sql).
 */
export const OWNER_UPSERT_KEYS = [
  'name', 'slug', 'default_venue_id', 'default_city_id', 'default_local_start_time',
  'default_duration_minutes', 'default_start_date', 'default_level', 'default_ticket_url',
  'default_description', 'default_cover_image_url', 'default_music_styles', 'default_gallery',
  'default_video_urls', 'timezone', 'category', 'default_passes', 'instagram_url', 'payment_methods',
] as const;

/**
 * series.upsert keys an owner may send on a CREATE (admin D3 v_owner_create_keys):
 * the list above plus `format`, plus the organiser key, which names the one
 * organiser the series belongs to. That key is the legacy column name the
 * architecture lint bans app-wide, so selfServeApi.ts (the one allow-listed
 * file) attaches it in createSeriesCommand; this mirror lists what the create
 * screen itself may emit.
 */
export const OWNER_CREATE_KEYS = [...OWNER_UPSERT_KEYS, 'format'] as const;


// ---- the price list (admin D8 _owner_passes_problem_p5) ------------------------

/**
 * One price an owner may send in `default_passes` (event_series_p5.passes, read
 * publicly as meta_data_public.tickets): exactly these keys, an id that is a
 * unique uuid (the public ticket parser drops an entry without one), a name of
 * 1-120 characters, a price that is a NUMBER of at most 6 digits and 2
 * decimals or null, an optional currency and description.
 */
export interface OwnerPass {
  id: string;
  name: string;
  price: number | null;
  currency?: OwnerCurrency;
  description?: string | null;
}
export const OWNER_PASS_KEYS = ['id', 'name', 'price', 'currency', 'description'] as const;
export const OWNER_PASS_CURRENCIES = ['GBP', 'EUR', 'USD'] as const;
export type OwnerCurrency = (typeof OWNER_PASS_CURRENCIES)[number];
export const MAX_OWNER_PASSES = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PRICE_RE = /^[0-9]{1,6}(\.[0-9]{1,2})?$/;

/**
 * The stored price list as owner-shaped entries, or null when the owner may not
 * edit it from here: an entry the Bachata Calendar team shaped (tiers, days,
 * quantities, sale windows: keys outside OWNER_PASS_KEYS), an id that is not a
 * uuid, or anything else the server rule would refuse on save. A numeric
 * string price (the admin pass editor's shape) reads as its number. No list
 * reads as [].
 */
export function ownerPassesFromStored(raw: unknown): OwnerPass[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_OWNER_PASSES) return null;
  const ids = new Set<string>();
  const out: OwnerPass[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const e = entry as Record<string, unknown>;
    if (Object.keys(e).some((k) => !(OWNER_PASS_KEYS as readonly string[]).includes(k))) return null;
    if (typeof e.id !== 'string' || !UUID_RE.test(e.id) || ids.has(e.id)) return null;
    ids.add(e.id);
    if (typeof e.name !== 'string' || !e.name.trim() || e.name.length > 120) return null;
    let price: number | null;
    if (e.price == null) price = null;
    else if (typeof e.price === 'number' && PRICE_RE.test(String(e.price))) price = e.price;
    else if (typeof e.price === 'string' && PRICE_RE.test(e.price.trim())) price = Number(e.price.trim());
    else return null;
    if ('currency' in e && !(OWNER_PASS_CURRENCIES as readonly unknown[]).includes(e.currency)) return null;
    if (e.description != null && (typeof e.description !== 'string' || e.description.length > 500)) return null;
    const pass: OwnerPass = { id: e.id, name: e.name, price };
    if ('currency' in e) pass.currency = e.currency as OwnerCurrency;
    if ('description' in e) pass.description = (e.description as string | null) ?? null;
    out.push(pass);
  }
  return out;
}

/** The price list as the server stores it, for comparing before and after. */
const passesKey = (passes: OwnerPass[]) =>
  JSON.stringify(passes.map((p) => [p.id, p.name.trim(), p.price, p.currency ?? null, p.description ?? null]));
export type OwnerFormat = 'one_off' | 'recurring';

/** occurrence.set_override keys an owner may send (one date's own changes). */
export const OWNER_OVERRIDE_KEYS = [
  'venue_id', 'city_id', 'cancellation_reason_label', 'cover_image_url', 'ticket_url', 'description',
] as const;

export const OWNER_CANCEL_KEYS = ['cancelled', 'reason'] as const;

export type OwnerCommandKind = (typeof OWNER_COMMAND_KINDS)[number] | (typeof AW1_COMMAND_KINDS)[number];
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
  ticketUrl: string;
  coverImageUrl: string;
  /** The Instagram link (admin D8). Absent on a create. Blank clears. */
  instagramUrl?: string;
  /**
   * The price list (admin D8). Absent on a create; null when the stored list
   * is not owner-shaped (ownerPassesFromStored), so the form cannot send it.
   */
  passes?: OwnerPass[] | null;
}

type TextField = Exclude<keyof BasicsDraft, 'name' | 'instagramUrl' | 'passes'>;

const FIELD_KEY: Record<TextField, OwnerUpsertKey> = {
  description: 'default_description',
  venueId: 'default_venue_id',
  startTime: 'default_local_start_time',
  durationMinutes: 'default_duration_minutes',
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
  // The Instagram link: blank clears (the handler NULLIFs it).
  if (draft.instagramUrl !== undefined && (draft.instagramUrl ?? '').trim() !== (initial.instagramUrl ?? '').trim()) {
    payload.instagram_url = draft.instagramUrl.trim();
  }
  // The price list goes whole, and only when it changed; [] clears it. Never
  // when the stored list is the team's shape (null): the owner rule would
  // refuse it, and resending would drop the team's keys.
  if (Array.isArray(draft.passes) && Array.isArray(initial.passes) && passesKey(draft.passes) !== passesKey(initial.passes)) {
    payload.default_passes = draft.passes.map((p) => {
      const pass: OwnerPass = { id: p.id, name: p.name.trim(), price: p.price };
      if (p.currency) pass.currency = p.currency;
      if (p.description != null) pass.description = p.description;
      return pass;
    });
  }
  return payload;
}

export const hasBasicsChanges = (initial: BasicsDraft, draft: BasicsDraft) =>
  Object.keys(basicsPayload(initial, draft)).length > 1 || draft.name.trim() !== initial.name.trim();

/**
 * series.upsert. `category` never goes: the server derives it from the
 * sessions (src/lib/eventCategory.ts and its SQL twin) and ignores a sent one,
 * so sending it would only look like it set something.
 */
export function upsertCommand(payload: Record<string, unknown>): OwnerCommand {
  const { category: _serverDerived, ...rest } = payload;
  return { kind: 'series.upsert', payload: rest };
}

/**
 * The ONE place an upsert on an EXISTING series gets its `name`. The handler
 * requires it on every upsert (`invalid_payload: name required`), so the route
 * steps (New event venue/date/time/flyer, the flyer page) build their command
 * without it and every send passes it through here with the name from the
 * fresh workspace read. Only a series.upsert that carries no name is touched;
 * any other kind, or an upsert that already names the series, goes unchanged.
 */
export function withSeriesName(command: OwnerCommand, seriesName: string): OwnerCommand {
  if (command.kind !== 'series.upsert' || String(command.payload.name ?? '').trim()) return command;
  return { ...command, payload: { name: seriesName.trim(), ...command.payload } };
}

// ---- the date list (W4) --------------------------------------------------------

export const addDateCommand = (date: string): OwnerCommand => ({ kind: 'series.add_date', payload: { date } });
export const skipDateCommand = (occurrenceId: string): OwnerCommand => ({ kind: 'series.skip_date', payload: { occurrence_id: occurrenceId } });
export const unskipDateCommand = (date: string): OwnerCommand => ({ kind: 'series.unskip_date', payload: { date } });
/** Pause / resume (`{to}`, 4.11). There is no review step (D4): the UI never sends pending_review. */
export const lifecycleCommand = (to: 'paused' | 'live' | 'archived'): OwnerCommand => ({ kind: 'series.set_lifecycle', payload: { to } });

// ---- one date (W5) -------------------------------------------------------------

/** Cancel with a reason that is a cancellation_reasons label (required for owners). */
export const cancelCommand = (reason: string): OwnerCommand => ({ kind: 'occurrence.cancel', payload: { cancelled: true, reason } });
/** series.cancel_one_off (ER AD4) accepts exactly this key; any other key is refused. */
export const OWNER_CANCEL_ONE_OFF_KEYS = ['reason'] as const;
/**
 * Cancel a one-off: the server cancels its ONE date through the date-cancel writer and the
 * series stays live. Aimed at the SERIES (series_command_p5). The reason is a
 * cancellation_reasons label, as for cancelCommand; the undo is uncancelCommand on the date.
 */
export const cancelOneOffCommand = (reason: string): OwnerCommand => ({ kind: 'series.cancel_one_off', payload: { reason } });
/** Put a CANCELLED date back (D46); a taken-off date uses unskipDateCommand. */
export const uncancelCommand = (): OwnerCommand => ({ kind: 'occurrence.cancel', payload: { cancelled: false } });
/** Move one date to another day (D39); the server rebuilds the instant from the wall-clock time (R3-18). */
export const moveDateCommand = (toDate: string): OwnerCommand => ({ kind: 'occurrence.move_date', payload: { to_date: toDate } });
/**
 * A command aimed at ONE date (occurrence_command_p5), not the series, inside a list
 * the series runner sends (useRunCommands): it goes against the date's own version.
 */
export interface DateStep extends OwnerCommand {
  occurrence: { id: string; version: number };
}
/** Organisers never delete a date (owner answer 20, wave B0): a one-date event's date MOVES. */
export const moveDateStep = (date: { id: string; version: number }, toDate: string): DateStep =>
  ({ ...moveDateCommand(toDate), occurrence: { id: date.id, version: date.version } });

/** London wall-clock HH:MM digits, sent as typed; an empty end lets the server keep the length. */
export const setTimeCommand = (start: string, end: string | null): OwnerCommand => ({
  kind: 'occurrence.set_time',
  payload: { new_local_start: start, new_local_end: end && end.trim() ? end : null },
});
export const resetTimeCommand = (): OwnerCommand => ({ kind: 'occurrence.set_time', payload: { reset: true } });

/**
 * Several dates at once (admin_bulk_occurrence_command_p5, which admits an
 * owner/manager of the series: prod fn lines 75 + 127). Not an aggregate kind,
 * so it is its own type; the envelope targets the SERIES at its version.
 */
export type BulkCommand =
  | { kind: 'occurrence.bulk_cancel'; payload: { occurrence_ids: string[]; reason: string } }
  | { kind: 'occurrence.bulk_shift'; payload: { occurrence_ids: string[]; shift_days: number } };
export const bulkCancelCommand = (occurrenceIds: string[], reason: string): BulkCommand =>
  ({ kind: 'occurrence.bulk_cancel', payload: { occurrence_ids: occurrenceIds, reason } });
export const bulkShiftCommand = (occurrenceIds: string[], shiftDays: number): BulkCommand =>
  ({ kind: 'occurrence.bulk_shift', payload: { occurrence_ids: occurrenceIds, shift_days: shiftDays } });

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

// ---- create (W3) ---------------------------------------------------------------

/**
 * A create is a series.upsert whose target_id names no row: the handler inserts
 * the series under that id (COALESCE(p_series_id, gen_random_uuid())), so the
 * screen chooses the id up front and lands on /account/series/:id afterwards.
 */
export const newSeriesId = newIdempotencyKey;

/**
 * The series' wall-clock zone. The handler stores 'UTC' when the key is absent
 * (measured on E2E 2026-10-04), which would shift every London time, so a
 * create always sends it.
 */
export const SERIES_TIMEZONE = 'Europe/London';

/** The create screen's draft: the basics plus what only a create may set. */
export interface CreateDraft extends BasicsDraft {
  format: OwnerFormat;
  /** The party's date, or the weekly class's first date (YYYY-MM-DD, London). */
  startDate: string;
}

/** The optional text fields a create sends only when set (keys from FIELD_KEY). */
const CREATE_TEXT_FIELDS = ['ticketUrl', 'coverImageUrl', 'description'] as const;

/**
 * series.upsert payload for a create, WITHOUT the organiser key (see
 * OWNER_CREATE_KEYS). Always: name, format, the start date, the start time and
 * the time zone; never category (derived from the sessions, see
 * upsertCommand). Optional fields go only when set: a create with an
 * absent key lands NULL anyway, and a blank would echo through the handler's
 * NULLIF for nothing.
 *
 * `cityId` is the series' default_city_id (Lever 2 B1): the server takes the city
 * only from this payload, and a series with no city cannot be approved. Sent only
 * when known (see createCity.resolveCreateCityId); never guessed.
 */
export function createPayload(draft: CreateDraft, cityId?: string | null): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    format: draft.format,
    default_start_date: draft.startDate,
    default_local_start_time: draft.startTime,
    timezone: SERIES_TIMEZONE,
  };
  if (draft.durationMinutes) payload.default_duration_minutes = draft.durationMinutes;
  if (draft.venueId) payload.default_venue_id = draft.venueId;
  if (cityId) payload.default_city_id = cityId;
  CREATE_TEXT_FIELDS.forEach((field) => {
    const value = draft[field].trim();
    if (value) payload[FIELD_KEY[field]] = value;
  });
  return payload;
}

/**
 * series.upsert payload for the New event DRAFT (D44): created at the name
 * step with only the name, the format from the URL and the zone; every later
 * step upserts the rest. Without the organiser key, like createPayload
 * (selfServeApi.createSeriesCommand attaches it).
 */
export function createDraftPayload(name: string, format: OwnerFormat): Record<string, unknown> {
  return { name: name.trim(), format, timezone: SERIES_TIMEZONE };
}

/**
 * The one rule an owner may set (admin D3 _owner_weekly_rule_problem_p5): every
 * week on ONE weekday (0 = Sunday .. 6 = Saturday), open-ended. The rule
 * materialises from the series' default_start_date, so the create sends the
 * first date there and the weekday here.
 */
export const weeklyRuleCommand = (weekday: number): OwnerCommand => ({
  kind: 'series.set_recurrence',
  payload: { mode: 'weekly', weekdays: [weekday], end: { kind: 'none' } },
});

// ---- parity wave 1 (SW1): the series programme and the event's organisers -----------
// Two kinds the server admits for an owner only once admin AW1 (migrations
// 20261126220000 / 20261126230000) is on prod; every control that sends one sits
// behind shared/parityGate.ts. They are NOT in OWNER_COMMAND_KINDS (that list mirrors
// the prod v_owner_kinds snapshot the mirror test pins). The payloads are the ones the
// admin editor sends: _cmd_series_set_program_p5 takes the COMPLETE tree {days:[...]}
// (it deletes and re-inserts); the organisers builder lives in selfServeApi.ts, the one
// file the architecture lint lets spell the organiser list key.
export const AW1_COMMAND_KINDS = ['series.set_program', 'series.set_organisers'] as const;

/** series.set_program: the whole programme tree, days > sections > items > people. */
export const setProgramCommand = (days: unknown[]): OwnerCommand => ({ kind: 'series.set_program', payload: { days } });

