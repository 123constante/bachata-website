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

// series_go_live_check_v1 is not in the generated Database type yet: string-named boundary (check:rpc-typing).
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export interface GoLiveItem { code: string; section: string }
export interface ProfileMissing { area: 'dancer' | 'organiser'; organiserId: string | null; fields: string[] }
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
 * The ONE label per code (D49). The six A-DB1 codes, the D55 readiness codes
 * (name, country, organiser) and the recommended ticket link.
 */
export const GO_LIVE_LABEL: Readonly<Record<string, string>> = {
  venue: 'A venue',
  city: 'A city',
  upcoming_date: 'An upcoming date',
  session: 'At least one session with a title, start and end',
  cover: 'A flyer',
  description: 'A description',
  name: 'An event name',
  country: 'A city with a country on file',
  organiser: 'An active organiser',
  ticket_link: 'A ticket link',
};
/** The word beside a recommended item: it never blocks. */
export const RECOMMENDED_WORD = 'Recommended';
/** A code the map does not know yet still shows, in plain words, never as the code. */
export const UNKNOWN_ITEM_LABEL = 'Something else on the event';

export const goLiveLabel = (code: string): string =>
  Object.prototype.hasOwnProperty.call(GO_LIVE_LABEL, code) ? GO_LIVE_LABEL[code] : UNKNOWN_ITEM_LABEL;

/** The one profile row: how many profile fields are still to fill, in the ONE "N left" wording. */
export const profileRowLabel = (left: number) => `Complete your profile (${requiredLeftText(left)})`;
export const profileFieldsLeft = (c: GoLiveCheck): number => c.profileMissing.reduce((n, p) => n + p.fields.length, 0);
/** The profile row shows only when the rule applies to this person and something is left. */
export const showsProfileRow = (c: GoLiveCheck): boolean => c.profileRuleApplies && profileFieldsLeft(c) > 0;

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
      if ((r.area !== 'dancer' && r.area !== 'organiser') || !(r.organiser_id === null || typeof r.organiser_id === 'string')
        || !Array.isArray(r.fields) || !r.fields.every((f) => typeof f === 'string')) throw new Error('go_live_bad_shape');
      return { area: r.area, organiserId: r.organiser_id as string | null, fields: r.fields as string[] };
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
