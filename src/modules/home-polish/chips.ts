// homePolish chip row: the pure rules behind Nearest / Party / Class / Fest.
// Filters are MULTI (OR between them), sort is SINGLE (Nearest on/off). Same dot colours as the map.

import { CATEGORY_COLORS, deriveCategory, type MapEvent } from '@/modules/home-map/mapTypes';

export type ChipCat = 'party' | 'class' | 'fest';

export const CHIP_CATS: { id: ChipCat; label: string; color: string }[] = [
  { id: 'party', label: 'Party', color: CATEGORY_COLORS.party },
  { id: 'class', label: 'Class', color: CATEGORY_COLORS.class },
  { id: 'fest', label: 'Fest', color: CATEGORY_COLORS.fest },
];

/** No filter on = everything. A party+class night ('mix') matches both Party and Class. */
export function matchesCats(e: Pick<MapEvent, 'type' | 'format' | 'has_party' | 'has_class'>, cats: ReadonlySet<ChipCat>): boolean {
  if (cats.size === 0) return true;
  const c = deriveCategory(e);
  if (c === 'mix') return cats.has('party') || cats.has('class');
  return (c === 'party' || c === 'class' || c === 'fest') && cats.has(c);
}

/** Over this, the nearest event is "far from you" (owner: ~60 mi; keep date order). */
export const FAR_MI = 60;
/** A fix rougher than ~5 km shows distances with "~". */
export const ROUGH_M = 5000;

export function formatMiles(mi: number, rough: boolean): string {
  const v = mi < 10 ? mi.toFixed(1) : String(Math.round(mi));
  return `${rough ? '~' : ''}${v} mi`;
}

const NEAREST_KEY = 'bc.homeNearest.v1';

/** The remembered Nearest PREFERENCE only -- never coordinates. */
export function readNearestPref(): boolean {
  try {
    return window.localStorage.getItem(NEAREST_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeNearestPref(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(NEAREST_KEY, '1');
    else window.localStorage.removeItem(NEAREST_KEY);
  } catch {
    /* storage blocked: the choice is not remembered */
  }
}

/** Resolves true only when the browser ALREADY says granted -- so a restore never prompts. */
export async function locationAlreadyGranted(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return false;
    const s = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return s.state === 'granted';
  } catch {
    return false;
  }
}
