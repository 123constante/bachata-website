// Go live (People arc A-WEB1a): the server owns the rule. series_go_live_check_v1
// answers "can this event go live, and what is missing", in the order to fix it;
// the owner path's Go live refusal carries the same JSON. This file is the api
// boundary, the typed parser and the ONE code -> label map every screen reads
// (D49: the same words as the admin editor's lib/goLiveCheck.ts).

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { detailEditPath } from '@/modules/organiser/flows/event/eventSteps';
import { requiredLeftText } from './profileProgress';
import { GO_LIVE_BLOCKERS } from './goLiveKeys';

// series_go_live_check_v1 is not in the generated Database type yet: string-named boundary (check:rpc-typing).
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export interface GoLiveItem { code: string; section: string }
export interface ProfileMissing { area: GoLiveArea; organiserId: string | null; fields: string[] }
/** A1 (invite journey) adds `teacher` and `dj` entries after dancer and organiser, organiser_id null. */
export type GoLiveArea = 'dancer' | 'organiser' | 'teacher' | 'dj';
const GO_LIVE_AREAS: ReadonlySet<string> = new Set<GoLiveArea>(['dancer', 'organiser', 'teacher', 'dj']);
/** A1's go-live keys for the role areas -> the role editor's field: from the one mapping (goLiveKeys). */
export { ROLE_GO_LIVE_FIELD } from './goLiveKeys';
export interface GoLiveCheck {
  ready: boolean;
  /** What blocks going live, in the server's order (fix the first one first). */
  eventMissing: GoLiveItem[];
  /** Worth adding, never blocking (the ticket link). */
  recommended: GoLiveItem[];
  profileRuleApplies: boolean;
  profileMissing: ProfileMissing[];
}

/**
 * The ONE label per code (D49, D82) lives in the one go-live mapping (goLiveKeys,
 * W2 walk fix 5): every code the server sends, the recommended ticket link, and
 * the twin codes that show once. Re-exported here for the screens that read it.
 */
export const GO_LIVE_LABEL: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(GO_LIVE_BLOCKERS).map(([c, d]) => [c, d.label]));
/** The word beside a recommended item: it never blocks. */
export const RECOMMENDED_WORD = 'Recommended';
export { UNKNOWN_ITEM_LABEL, goLiveLabel, profileFieldsLeft, showsProfileRow, thingsLeftText } from './goLiveKeys';

/** The one profile row: how many profile fields are still to fill, in the ONE "N left" wording. */
export const profileRowLabel = (left: number) => `Finish your profile (${requiredLeftText(left)})`;

/**
 * The organiser-area screen that fixes a section, or null when no screen does
 * (no link then, never a dead one). Every link comes back to this event (D37).
 */
export function goLiveFixHref(section: string, seriesId: string): string | null {
  const to = ({
    venue: ORG_PATHS.eventDetails(seriesId),
    basics: ORG_PATHS.eventDetails(seriesId),
    about: detailEditPath(seriesId, 'about'),
    tickets: detailEditPath(seriesId, 'tickets'),
    dates: ORG_PATHS.addEvent(seriesId),
    programme: ORG_PATHS.eventProgramme(seriesId),
    cover: ORG_PATHS.cover(seriesId),
    organisers: ORG_PATHS.eventOrganisers(seriesId),
    payment: detailEditPath(seriesId, 'payment'),
  } as Record<string, string | undefined>)[section];
  return to ? withReturnTo(to, ORG_PATHS.event(seriesId)) : null;
}

export const withReturnTo = (to: string, back: string) => `${to}${to.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(back)}`;

const item = (v: unknown): GoLiveItem => {
  const r = (v ?? {}) as Record<string, unknown>;
  if (typeof r.code !== 'string' || typeof r.section !== 'string') throw new Error('go_live_bad_shape');
  return { code: r.code, section: r.section };
};

export function parseGoLiveCheck(raw: unknown): GoLiveCheck {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('go_live_bad_shape');
  const { ready, event_missing: missing, recommended, profile_rule_applies: applies, profile_missing: profile } = o;
  if (typeof ready !== 'boolean' || !Array.isArray(missing) || !Array.isArray(recommended) || typeof applies !== 'boolean'
    || !Array.isArray(profile)) throw new Error('go_live_bad_shape');
  return {
    ready,
    eventMissing: missing.map(item),
    recommended: recommended.map(item),
    profileRuleApplies: applies,
    profileMissing: profile.map((p) => {
      const r = (p ?? {}) as Record<string, unknown>;
      if (typeof r.area !== 'string' || !GO_LIVE_AREAS.has(r.area) || !(r.organiser_id === null || typeof r.organiser_id === 'string')
        || !Array.isArray(r.fields) || !r.fields.every((f) => typeof f === 'string')) throw new Error('go_live_bad_shape');
      return { area: r.area as GoLiveArea, organiserId: r.organiser_id as string | null, fields: r.fields as string[] };
    }),
  };
}

export const goLiveCheckQueryKey = (seriesId: string) => ['series-go-live-check', seriesId] as const;

export async function fetchGoLiveCheck(seriesId: string): Promise<GoLiveCheck> {
  const { data, error } = await rpc('series_go_live_check_v1', { p_series_id: seriesId });
  if (error) throw new Error(error.message);
  return parseGoLiveCheck(data);
}

export function useGoLiveCheck(seriesId: string, enabled = true) {
  return useQuery({ queryKey: goLiveCheckQueryKey(seriesId), queryFn: () => fetchGoLiveCheck(seriesId), enabled: !!seriesId && enabled });
}

const REFUSAL = /needs a ready series:\s*(\{[\s\S]*\})\s*$/;
const json = (text: unknown): unknown => {
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
};

/**
 * The readable refusal of a Go live command (A-DB1): `permission_denied:
 * series.set_lifecycle <from> -> live needs a ready series: <json>`, the same
 * JSON in PostgREST `details`. Null for any other error.
 */
export function goLiveRefusal(error: unknown): GoLiveCheck | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { message?: unknown; details?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  if (!/needs a ready series/.test(message)) return null;
  for (const raw of [json(e.details), json(message.match(REFUSAL)?.[1])]) {
    try { if (raw) return parseGoLiveCheck(raw); } catch { /* the other copy, else null */ }
  }
  return null;
}
