import { fetchGateRaw } from '../api/gateRpc';
import { fetchPublicExtras } from '../api/rpc';
import { NO_EXTRAS, type PublicPageV2Data } from './model';

/**
 * The route loader's one call (app/routes/dancers.tsx). Never throws, never hangs.
 *
 * - Flag closed: `page: null`, and the page renders exactly as today.
 * - Flag read failed (network, odd shape, or slower than PUBLIC_PAGE_DEADLINE_MS):
 *   `page: null` too, and `degraded: true` so the loader caches that answer only
 *   briefly instead of for the full edge TTL.
 * - Flag open: v2, with the extras from get_public_dancer_extras_v1. An extras
 *   failure is not a reason to hide the page: v2 shows without bio / languages /
 *   WhatsApp, `extrasOk: false`, and `degraded: true`. SQL null (hidden, paused,
 *   archived) cannot happen for a page that renders: anon RLS on dancer_profiles
 *   uses the same visibility predicate, so the loader has already 404'd.
 *
 * Both reads start at once (the loader also starts this beside its own profile
 * read); when the flag is closed the extras answer is dropped.
 */
export const PUBLIC_PAGE_DEADLINE_MS = 2500;

/** The loader's bound on the edge cache for a degraded answer (seconds). */
export const DEGRADED_EDGE_TTL_SECONDS = 60;

export type PublicPageLoad = { page: PublicPageV2Data | null; degraded: boolean };

const withDeadline = <T>(work: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('public page read timed out')), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
};

export const loadPublicPageV2 = async (profileId: string, deadlineMs = PUBLIC_PAGE_DEADLINE_MS): Promise<PublicPageLoad> => {
  const [gate, extras] = await Promise.allSettled([
    withDeadline(fetchGateRaw(), deadlineMs),
    withDeadline(fetchPublicExtras(profileId), deadlineMs),
  ]);
  if (gate.status !== 'fulfilled') return { page: null, degraded: true };
  if (!gate.value.open) return { page: null, degraded: false };
  const extrasOk = extras.status === 'fulfilled';
  return {
    page: { extras: extrasOk && extras.value ? extras.value : NO_EXTRAS, extrasOk },
    degraded: !extrasOk,
  };
};
