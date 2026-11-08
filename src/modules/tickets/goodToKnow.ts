/**
 * "Good to know" chips for the Tickets page (mockups-7 section 2b).
 * One builder, fixed order, show only known values, never "No bar".
 * Chips are information only. Pure: all inputs are plain values.
 */
export type ChipKind = 'length' | 'id' | 'bar' | 'cloakroom' | 'floor' | 'music' | 'deadline' | 'parking';

export interface Chip { kind: ChipKind; text: string; must?: boolean }

export interface GoodToKnowInput {
  startIso: string | null;
  endIso: string | null;
  /** Programme fallback for length: first start / last end. */
  programmeStartIso: string | null;
  programmeEndIso: string | null;
  idRequired: boolean | null;
  bar: boolean | null;
  cloakroom: boolean | null;
  facilities: readonly string[];
  floorType: string | null;
  musicStyles: readonly string[];
  /** Latest ticket close time, else null (we then use the event start). */
  latestCloseIso: string | null;
  parking: string | null;
  timeZone: string;
}

export const MAX_MUSIC = 3;

const clean = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);
const has = (list: readonly string[], re: RegExp) => list.some((f) => re.test(f));

export function lengthText(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const mins = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
  if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hs = h === 1 ? '1 hour' : `${h} hours`;
  if (m === 0) return hs;
  return h === 0 ? `${m} minutes` : `${hs} ${m} minutes`;
}

export function floorText(raw: string | null): string | null {
  const v = clean(raw);
  if (!v) return null;
  const known: Record<string, string> = { wood: 'Wooden', wooden: 'Wooden', sprung: 'Sprung', carpet: 'Carpet', concrete: 'Concrete', tile: 'Tiled' };
  const k = known[v.toLowerCase()];
  return k ? `${k} floor` : v;
}

export function musicText(styles: readonly string[]): string | null {
  const s = styles.map((x) => x.trim()).filter(Boolean);
  if (s.length === 0) return null;
  const shown = s.slice(0, MAX_MUSIC).join(' · ');
  return s.length > MAX_MUSIC ? `${shown} +${s.length - MAX_MUSIC}` : shown;
}

export function deadlineText(iso: string | null, timeZone: string): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(d).replace(',', '');
  const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const ap = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toLowerCase();
  return `Tickets until ${day}, ${hour}${minute === '00' ? '' : `:${minute}`}${ap}`;
}

export function buildChips(i: GoodToKnowInput): Chip[] {
  const out: Chip[] = [];
  const len = lengthText(i.startIso, i.endIso) ?? lengthText(i.programmeStartIso, i.programmeEndIso);
  if (len) out.push({ kind: 'length', text: len });
  if (i.idRequired === true) out.push({ kind: 'id', text: 'Bring photo ID', must: true });
  if (i.bar === true || (i.bar === null && has(i.facilities, /\bbar\b/i))) out.push({ kind: 'bar', text: 'Bar' });
  if (i.cloakroom === true || (i.cloakroom === null && has(i.facilities, /cloak/i))) out.push({ kind: 'cloakroom', text: 'Cloakroom' });
  const floor = floorText(i.floorType);
  if (floor) out.push({ kind: 'floor', text: floor });
  const music = musicText(i.musicStyles);
  if (music) out.push({ kind: 'music', text: music });
  const dl = deadlineText(i.latestCloseIso ?? i.startIso, i.timeZone);
  if (dl) out.push({ kind: 'deadline', text: dl });
  const park = clean(i.parking);
  if (park) out.push({ kind: 'parking', text: park });
  return out;
}
