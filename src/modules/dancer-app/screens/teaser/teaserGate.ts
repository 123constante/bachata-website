/** The teaser's pure gate parts (see teaserModel.ts for the rest). */
import { createContext, useContext } from 'react';
import { profileIncomplete, type ProfileRead } from '../tickets/profileIncomplete';

/** The four tab screens the teaser replaces with read-only twins. Tickets stays the existing screen. */
export const TEASER_PATHS: readonly string[] = ['/app/home', '/app/nights', '/app/me', '/app/options'];

/** off = the real app; pending = the profile read is not back yet (draw nothing, no flash); on = the twins. */
export type TeaserState = 'off' | 'pending' | 'on';

/**
 * The teaser shows for a signed-in person the dancer gate ALLOWS (never view-only: their onboarding
 * calls raise 42501 area_closed) whose profile is unfinished (no dancer profile, or required steps
 * not done), with both flags on. A failed profile read = off: the real screens, as today.
 */
export const teaserState = (opts: { teaserFlag: boolean; ticketingFlag: boolean; viewOnly: boolean; read: ProfileRead }): TeaserState => {
  if (!opts.teaserFlag || !opts.ticketingFlag || opts.viewOnly) return 'off';
  if (opts.read.status === 'pending') return 'pending';
  return profileIncomplete(false, opts.read) ? 'on' : 'off';
};

/** Set by DancerAppShell, read by DancerAppRoutes (which screen to draw). */
export const TeaserContext = createContext<TeaserState>('off');
export const useTeaserState = (): TeaserState => useContext(TeaserContext);
