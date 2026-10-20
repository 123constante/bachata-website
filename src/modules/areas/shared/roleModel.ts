// Pure rules for the teacher / DJ details: server value <-> form value,
// client validation mirroring save_my_role_v1, the diff-first patch, and
// completeness. One copy, used by the profile form, the dashboards and the
// wizard steps alike.
import { LIST_ITEM_MAX, LIST_MAX_ITEMS, ROLE_FIELDS, YEARS_MAX, YEARS_MIN, type Role, type RoleField } from './fieldRegistry';
import type { RoleErrorCode } from './errorCopy';

export type Details = Record<string, unknown>;
/** Form value: years as typed text, lists as arrays, yes/no as boolean|null, text as a string. */
export type DraftValue = string | string[] | boolean | null;
export type Draft = Record<string, DraftValue>;

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** What the server holds -> what the form shows. Unknown shapes read as unset. */
export function toDraftValue(field: RoleField, v: unknown): DraftValue {
  switch (field.kind) {
    case 'years':
      return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
    case 'list':
      return asList(v);
    case 'yesno':
      return typeof v === 'boolean' ? v : null;
    default:
      return typeof v === 'string' ? v : '';
  }
}

export function toDraft(role: Role, details: Details): Draft {
  const out: Draft = {};
  for (const f of ROLE_FIELDS[role]) out[f.key] = toDraftValue(f, details[f.key]);
  return out;
}

/** Form value -> the value sent. Cleared text/years/yes-no send null; a cleared list sends []. */
export function toServerValue(field: RoleField, v: DraftValue): unknown {
  switch (field.kind) {
    case 'years': {
      const s = typeof v === 'string' ? v.trim() : '';
      if (s === '') return null;
      return /^\d+$/.test(s) ? Number(s) : s; // a non-number stays a string so validation refuses it
    }
    case 'list':
      return Array.isArray(v) ? v.map((x) => x.trim()).filter((x) => x !== '') : [];
    case 'yesno':
      return typeof v === 'boolean' ? v : null;
    default: {
      // Trims the ends only: pricing keeps its inner new lines.
      const s = typeof v === 'string' ? v.trim() : '';
      return s === '' ? null : s;
    }
  }
}

/** Length in characters, as the server counts it (an emoji is one, not two UTF-16 units). */
export function charLength(s: string): number {
  return [...s].length;
}

// The server refuses [[:cntrl:]] in text and list items; pricing keeps its new lines.
function hasControl(s: string, keepNewLines = false): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (keepNewLines && c === 10) continue;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

/** Client copy of the server's per-key rule; null when the value is fine. */
export function validateValue(field: RoleField, value: unknown): RoleErrorCode | null {
  if (value === null) return null;
  switch (field.kind) {
    case 'years':
      return typeof value === 'number' && Number.isInteger(value) && value >= YEARS_MIN && value <= YEARS_MAX ? null : 'invalid_years';
    case 'list': {
      const list = value as string[];
      return list.length <= LIST_MAX_ITEMS && list.every((x) => charLength(x) <= LIST_ITEM_MAX && !hasControl(x)) ? null : 'invalid_list';
    }
    case 'yesno':
      return typeof value === 'boolean' ? null : 'invalid_type';
    case 'link':
      return typeof value === 'string' && charLength(value) <= (field.max ?? 300) && !/\s/.test(value) && !hasControl(value) ? null : 'invalid_link';
    default: {
      return typeof value === 'string' && charLength(value) <= (field.max ?? 80) && !hasControl(value, field.kind === 'longtext') ? null : 'invalid_text';
    }
  }
}

/**
 * A list with the text typed but not yet added (D27): trimmed, and dropped
 * when the list already holds it (any case). Over the limits it is still
 * kept, so validation says why instead of the term being lost.
 */
export function withPending(list: string[], pending: string | undefined): string[] {
  const term = (pending ?? '').trim();
  if (term === '' || list.some((v) => v.trim().toLowerCase() === term.toLowerCase())) return list;
  return [...list, term];
}

/** The draft as it would be sent: each list field with its pending typed text added. */
export function withPendingDraft(role: Role, draft: Draft, pending: Record<string, string>): Draft {
  const out: Draft = { ...draft };
  for (const f of ROLE_FIELDS[role]) {
    if (f.kind === 'list' && pending[f.key]) out[f.key] = withPending(Array.isArray(draft[f.key]) ? (draft[f.key] as string[]) : [], pending[f.key]);
  }
  return out;
}

/** Two sent values are the same answer. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

/**
 * Diff-first: ONLY the keys whose sent value differs from what the server
 * holds. An untouched form returns {} and the caller sends nothing.
 */
export function diffPatch(role: Role, details: Details, draft: Draft): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of ROLE_FIELDS[role]) {
    const before = toServerValue(f, toDraftValue(f, details[f.key]));
    const after = toServerValue(f, draft[f.key] ?? toDraftValue(f, undefined));
    if (!sameValue(before, after)) patch[f.key] = after;
  }
  return patch;
}

/** Per-key validation errors for a patch (empty when it can be sent). */
export function validatePatch(role: Role, patch: Record<string, unknown>): Record<string, RoleErrorCode> {
  const errors: Record<string, RoleErrorCode> = {};
  for (const f of ROLE_FIELDS[role]) {
    if (!(f.key in patch)) continue;
    const e = validateValue(f, patch[f.key]);
    if (e) errors[f.key] = e;
  }
  return errors;
}

/** A field counts as filled when it holds an answer (No counts: it is an answer). */
export function isFilled(field: RoleField, v: unknown): boolean {
  switch (field.kind) {
    case 'years':
      return typeof v === 'number' && Number.isFinite(v);
    case 'list':
      return asList(v).some((x) => x.trim() !== '');
    case 'yesno':
      return typeof v === 'boolean';
    default:
      return typeof v === 'string' && v.trim() !== '';
  }
}

export interface Completeness { filled: number; total: number; percent: number }

/** filled keys / all keys: the ONE completeness rule, shown the same on both areas. */
export function completeness(role: Role, details: Details): Completeness {
  const fields = ROLE_FIELDS[role];
  const filled = fields.filter((f) => isFilled(f, details[f.key])).length;
  return { filled, total: fields.length, percent: Math.round((filled / fields.length) * 100) };
}

/** The ONE sentence for completeness, on both dashboards. */
export function completenessLine(c: Completeness): string {
  if (c.filled === 0) return 'No details added yet';
  if (c.filled === c.total) return `All ${c.total} details added`;
  return `${c.filled} of ${c.total} details added`;
}
