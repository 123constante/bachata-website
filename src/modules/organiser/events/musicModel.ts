// Music styles as chips (parity wave 1, SW1). The vocabulary is the one the admin
// editor offers (MUSIC_STYLES) plus Urban Kiz and Cuban, which prod series carry
// (counts read 2026-10-18). Stored values come in mixed case ("bachata", "Bachata",
// "sensualbachata"); a chip is selected when a stored value matches it ignoring case
// and spaces, and a stored style with no chip stays listed (selected) so a save never
// drops it. Pure; ONE series.upsert, null when the set did not change.

import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { MUSIC_STYLES, type EventWorkspace } from './eventModel';

export const MUSIC_VOCAB: string[] = [...MUSIC_STYLES, 'Urban Kiz', 'Cuban'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const ALIAS: Record<string, string> = { urbankiz: 'urbankiz', urbankizomba: 'urbankiz' };
const keyOf = (s: string) => ALIAS[norm(s)] ?? norm(s);

/** The chips to show: the vocabulary, then any stored style outside it (as stored). */
export function musicChips(stored: string[]): string[] {
  const known = new Set(MUSIC_VOCAB.map(keyOf));
  const extra = stored.filter((s) => !known.has(keyOf(s)));
  return [...MUSIC_VOCAB, ...extra];
}

export const isOn = (chip: string, selected: string[]) => selected.some((s) => keyOf(s) === keyOf(chip));

/** Toggle a chip. Turning one off drops every stored spelling of it; turning one on adds the chip's own spelling. */
export const toggleStyle = (selected: string[], chip: string): string[] =>
  isOn(chip, selected) ? selected.filter((s) => keyOf(s) !== keyOf(chip)) : [...selected, chip];

const sameSet = (a: string[], b: string[]) => {
  const x = [...new Set(a.map(keyOf))].sort();
  const y = [...new Set(b.map(keyOf))].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

export const musicChanged = (ws: Pick<EventWorkspace, 'musicStyles'>, next: string[]) => !sameSet(ws.musicStyles, next);

/** ONE series.upsert carrying `name` and default_music_styles; null when the set is the stored one. */
export function musicCommand(ws: Pick<EventWorkspace, 'musicStyles' | 'series'>, next: string[]): OwnerCommand | null {
  return musicChanged(ws, next) ? upsertCommand({ name: ws.series.name, default_music_styles: next }) : null;
}
