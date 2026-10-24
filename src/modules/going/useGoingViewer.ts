import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfileGateContext, useAuth, type ProfileGateValue } from '@/hooks/useAuth';
import { PROFILE_FIELDS, type ProfileField } from '@/lib/profileCompletion';
import type { GoingViewer } from './goingState';

/**
 * Who is looking, for the going mapping. Reads useAuth and ProfileGateContext
 * (the published completeness fact, profile_complete_v1) -- no request of its own.
 *
 * The client fact only decides what to SHOW: the database refuses an unfinished
 * profile (`profile_incomplete`) whatever this says, and that refusal maps to
 * the same state (goingState.foldRefusal).
 */
export type GoingViewerFacts = {
  authLoading: boolean;
  user: { is_anonymous?: boolean | null } | null | undefined;
  gate: ProfileGateValue | 'loading' | null;
};

/** The gate's missing fields, from its data (never its display text), in profile order. */
export const missingFromGate = (gate: Pick<ProfileGateValue, 'missing'>): ProfileField[] =>
  PROFILE_FIELDS.filter((f) => gate.missing?.includes(f));

export const goingViewerFor = (f: GoingViewerFacts): GoingViewer => {
  if (f.authLoading) return { kind: 'loading' };
  if (!f.user) return { kind: 'signed_out' };
  if (f.user.is_anonymous) return { kind: 'anonymous' };
  const gate = f.gate;
  if (gate === null || gate === 'loading') return { kind: 'unknown' };
  if (gate.status === 'complete') return { kind: 'finished' };
  if (gate.status === 'no_profile') return { kind: 'no_profile' };
  if (gate.status === 'incomplete') {
    return { kind: 'unfinished', missing: missingFromGate(gate) };
  }
  return { kind: 'unknown' };
};

export const useGoingViewer = (): GoingViewer => {
  const { user, isLoading } = useAuth();
  const gate = useContext(ProfileGateContext);
  return goingViewerFor({ authLoading: isLoading, user, gate });
};

/** Where the viewer is now (the Finish screen comes back here). */
export const useGoingReturnTo = (): string => {
  const { pathname, search } = useLocation();
  return `${pathname}${search}`;
};
