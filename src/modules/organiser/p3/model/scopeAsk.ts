import type { OwnerCommand } from '../../shared/seriesCommands';

/**
 * "This date only / all dates" (P3 scope ask, owner rule R1, decision D14). Pure: when to ask,
 * which fields the scoped call can carry, and the words. The RPC covers FOUR fields only; every
 * other field stays an all-dates save exactly as before (the series.upsert already keeps the
 * dates that own their value).
 */
export type ScopeField = 'cover_image_url' | 'gallery' | 'venue' | 'passes';

/** The one mapping of a field to the word the person reads. */
export const FIELD_WORD: Record<ScopeField, string> = {
  cover_image_url: 'pictures', gallery: 'pictures', venue: 'place', passes: 'prices',
};

export const ONE_DATE_WHY = 'Name, description, music and the other details change every date. Save those first, then change this one.';
export const MORE_DATES_NOTE = 'Use the date\u2019s own page for later dates.';
/** The most dates the "Just one date" list shows. */
export const MAX_LISTED_DATES = 8;

export interface ScopedChanges {
  fields: ScopeField[];
  /** The `changes` object of the scoped call (keys without the default_ prefix). */
  changes: Record<string, unknown>;
  /** Something the scoped call cannot carry also changed in the same draft. */
  unscopedChanged: boolean;
}

const SCOPED_KEY: Record<string, ScopeField> = {
  default_cover_image_url: 'cover_image_url', default_gallery: 'gallery', default_passes: 'passes',
};

/**
 * Reads a save plan: which scoped fields it changes and whether anything else does. The venue
 * goes with its city (the RPC refuses one without the other): a venue with no city is NOT
 * scoped, it stays part of today's all-dates upsert. `nameChanged`: the upsert always carries
 * the name, so only the screen knows whether it was edited.
 */
export function scopedChangesOf(plan: readonly OwnerCommand[], nameChanged = false): ScopedChanges {
  const fields: ScopeField[] = [];
  const changes: Record<string, unknown> = {};
  let unscoped = nameChanged;
  for (const c of plan) {
    if (c.kind !== 'series.upsert') { unscoped = true; continue; }
    for (const [k, v] of Object.entries(c.payload)) {
      if (k === 'name') continue;
      if (k in SCOPED_KEY) { fields.push(SCOPED_KEY[k]); changes[SCOPED_KEY[k]] = v; continue; }
      if (k === 'default_venue_id' || k === 'default_city_id') continue;
      unscoped = true;
    }
    const venue = c.payload.default_venue_id;
    const city = c.payload.default_city_id;
    if (typeof venue === 'string' && venue) {
      if (typeof city === 'string' && city) { fields.push('venue'); changes.venue_id = venue; changes.city_id = city; } else unscoped = true;
    } else if (typeof city === 'string' && city) unscoped = true;
  }
  return { fields, changes, unscopedChanged: unscoped };
}

export const scopedFieldsChanged = (plan: readonly OwnerCommand[], nameChanged = false): ScopeField[] => scopedChangesOf(plan, nameChanged).fields;

/** The keys the preview is asked for: the venue as venue_id (the reply reports both its keys). */
export const previewKeysOf = (fields: readonly ScopeField[]): string[] => [...new Set(fields.map((f) => (f === 'venue' ? 'venue_id' : f)))];

/** Ask only when a scoped field changed AND two or more future scheduled dates (the preview's totals.dates) would take it. */
export function needsScopeAsk({ changedScoped, futureDates }: { changedScoped: readonly ScopeField[]; unscopedChanged: boolean; futureDates: number }): boolean {
  return changedScoped.length > 0 && futureDates >= 2;
}

/** What the sheet's two buttons do. All dates is always on. */
export function scopeChoices({ unscopedChanged }: { unscopedChanged: boolean }): { oneEnabled: boolean; oneWhy: string | null; allSendsPlain: boolean } {
  return unscopedChanged
    ? { oneEnabled: false, oneWhy: ONE_DATE_WHY, allSendsPlain: true }
    : { oneEnabled: true, oneWhy: null, allSendsPlain: false };
}

export interface PreviewTotals { dates: number; applied: number; kept: number; curated_but_inherits: number }
export interface PreviewDate { occurrence_id: string; occurrence_date: string; kept_fields: string[]; applied_fields: string[] }

const wordOfKey = (k: string): string => (k === 'venue_id' || k === 'city_id' ? FIELD_WORD.venue : FIELD_WORD[k as ScopeField] ?? 'details');

/** The line under "All N dates": who changes and who keeps what they edited by hand. */
export function previewLine(totals: PreviewTotals, dates: readonly PreviewDate[], _fields: readonly ScopeField[]): string {
  const keepers = dates.filter((x) => x.kept_fields.length > 0);
  const m = keepers.length;
  if (m === 0) return 'Every date changes.';
  const words = [...new Set(keepers.flatMap((x) => x.kept_fields.map(wordOfKey)))];
  const word = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0];
  const n = totals.applied;
  const head = n === 0 ? 'No date changes.' : `${n} ${n === 1 ? 'date changes' : 'dates change'}.`;
  const who = n === 0 && m === totals.dates && m > 1 ? `All ${m}` : `${m}`;
  const keeps = m === 1 && who === '1' ? 'keeps its own' : 'keep their own';
  const pron = m === 1 ? 'it' : 'them';
  return `${head} ${who} ${keeps} ${word} because you edited ${pron} by hand.`;
}
