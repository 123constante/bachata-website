/**
 * Per-venue transport "mode" — the public mirror of the admin's
 * `lib/transportModes.ts`. Each `transport_json.nearest_stations[]` entry may
 * carry a `mode` describing HOW you arrive (metro / airport / taxi / …) so a
 * venue reached by plane + taxi (e.g. a destination festival resort) renders
 * the right icon and wording instead of a hardcoded London train + "min walk".
 *
 * `mode` rides inside the free-form `transport_json` blob (no migration).
 * Legacy entries have no mode → default 'metro', which preserves the existing
 * London look (the venue detail card keeps the TfL roundel for metro).
 *
 * Mirrors `tubeLineColour.ts`: a const map + a safe resolver with a default.
 */

import type { LucideIcon } from 'lucide-react';
import {
  TrainFront,
  Train,
  TramFront,
  Bus,
  Plane,
  Ship,
  CarTaxiFront,
  Footprints,
} from 'lucide-react';

export type TransportMode =
  | 'metro'
  | 'train'
  | 'tram'
  | 'bus'
  | 'airport'
  | 'ferry'
  | 'taxi'
  | 'shuttle'
  | 'walk';

export type TransportModeMeta = {
  mode: TransportMode;
  Icon: LucideIcon;
  /** Eyebrow label, e.g. "Nearest station", "Nearest airport". */
  label: string;
  /** Walk-from-stop modes say "min walk"; ride modes say "min away". */
  isWalk: boolean;
};

const MODES: Record<TransportMode, TransportModeMeta> = {
  metro:   { mode: 'metro',   Icon: TrainFront,   label: 'Nearest station', isWalk: true },
  train:   { mode: 'train',   Icon: Train,        label: 'Nearest station', isWalk: true },
  tram:    { mode: 'tram',    Icon: TramFront,    label: 'Nearest stop',    isWalk: true },
  bus:     { mode: 'bus',     Icon: Bus,          label: 'Nearest stop',    isWalk: true },
  airport: { mode: 'airport', Icon: Plane,        label: 'Nearest airport', isWalk: false },
  ferry:   { mode: 'ferry',   Icon: Ship,         label: 'Nearest port',    isWalk: false },
  taxi:    { mode: 'taxi',    Icon: CarTaxiFront, label: 'By taxi',         isWalk: false },
  shuttle: { mode: 'shuttle', Icon: Bus,          label: 'By shuttle',      isWalk: false },
  walk:    { mode: 'walk',    Icon: Footprints,   label: 'On foot',         isWalk: true },
};

export const DEFAULT_TRANSPORT_MODE: TransportMode = 'metro';

export const isTransportMode = (v: unknown): v is TransportMode =>
  typeof v === 'string' && v.trim().toLowerCase() in MODES;

/**
 * Resolve a raw `mode` value to its metadata. Unknown / missing / garbage →
 * the metro default (never throws). The `_lineNames` param is reserved for a
 * possible future inference pass; today the admin writes an explicit mode and
 * legacy rows are all London, so a flat metro default is correct.
 */
export const resolveTransportMode = (
  mode: string | null | undefined,
  _lineNames?: string[] | null,
): TransportModeMeta => {
  if (typeof mode === 'string') {
    const key = mode.trim().toLowerCase();
    if (key in MODES) return MODES[key as TransportMode];
  }
  return MODES[DEFAULT_TRANSPORT_MODE];
};

export type MinutesLabel = { Icon: LucideIcon; text: string };

/**
 * The minutes pill — single source of truth so every render site agrees.
 * Walk modes → Footprints + "N min walk"; ride modes → the mode icon +
 * "N min away". Returns null for a missing / non-finite value.
 */
export const minutesLabel = (
  meta: TransportModeMeta,
  minutes: number | null | undefined,
): MinutesLabel | null => {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null;
  return meta.isWalk
    ? { Icon: Footprints, text: `${minutes} min walk` }
    : { Icon: meta.Icon, text: `${minutes} min away` };
};
