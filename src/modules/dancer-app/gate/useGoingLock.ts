import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfileGateContext, useAuth, type ProfileGateValue } from '@/hooks/useAuth';
import { appWelcomeHref, hasOrganiserIntent } from '@/lib/accountRouting';
import { PROFILE_FIELDS, completenessFact, type ProfileField } from '@/lib/profileCompletion';
import { NEXT_STEP } from '../api/nextStep';
import type { StrengthStep } from '../api/types';
import { useDancerArea, type DancerAreaState } from './useDancerArea';

/**
 * The Going / Interested lock (B1b S1, PLAN C14). A person inside the dancer
 * area whose profile is not finished cannot say they are going: the server
 * already refuses them with `profile_incomplete`, so the buttons say why first
 * and link to the onboarding.
 *
 * Reads useDancerArea() and ProfileGateContext only -- no request of its own.
 * Every doubt (loading, error, signed out, not in the area, organiser-type, no
 * dancer profile) is UNLOCKED: today's buttons, and the server still refuses.
 *
 * The event page block (RsvpBlock) and the festival hub both read this one
 * mapping, so the two surfaces cannot disagree.
 */
export type GoingLock = { locked: boolean; reason: string | null; href: string | null };

export const GOING_UNLOCKED: GoingLock = { locked: false, reason: null, href: null };

/** The words on the link under the buttons; it goes to `href`. */
export const GOING_LOCK_LINK_LABEL = 'Finish your profile';

/** The missing-step order is the four required steps, as nextStep's REQUIRED_STEPS. */
const FIELD_STEP: Record<ProfileField, StrengthStep> = {
  first_name: 'first_name',
  based_city_id: 'city',
  dance_role: 'role',
  avatar_url: 'photo',
};

/** Every non-empty run of PROFILE_FIELDS in profile order: the lists the gate can carry. */
const MISSING_LISTS: ProfileField[][] = Array.from({ length: (1 << PROFILE_FIELDS.length) - 1 }, (_, i) =>
  PROFILE_FIELDS.filter((_, bit) => ((i + 1) >> bit) & 1),
);

/**
 * Which fields the published gate says are missing. ProfileGateValue carries the
 * list only inside its rating reason (lib/profileCompletion's completenessFact),
 * so this finds the list whose reason it is -- through that same mapping, never
 * by reading the words. null = it does not name one (then the reason is general).
 */
export const missingFromGate = (gate: ProfileGateValue): ProfileField[] | null => {
  const reason = gate.gateFor('/').reason;
  return MISSING_LISTS.find((m) => completenessFact({ status: 'incomplete', missing: m }).reason === reason) ?? null;
};

/** "Add your photo to say you're going" -- the next missing step's own words (api/nextStep). */
export const goingLockReason = (missing: readonly ProfileField[] | null): string => {
  if (!missing || missing.length === 0) return "Finish your profile to say you're going";
  const next = NEXT_STEP[FIELD_STEP[missing[0]]].label;
  return missing.length === 1 ? `${next} to say you're going` : `${next} and a few details to say you're going`;
};

export type GoingLockFacts = {
  signedIn: boolean;
  organiser: boolean;
  area: DancerAreaState;
  gate: ProfileGateValue | 'loading' | null;
  /** Where the person is now; onboarding brings them back here. */
  returnTo: string;
};

/** The one mapping: person state -> lock. */
export const goingLockFor = (f: GoingLockFacts): GoingLock => {
  if (!f.signedIn || f.organiser) return GOING_UNLOCKED;
  if (f.area.status !== 'ready' || !f.area.allowed) return GOING_UNLOCKED;
  if (f.gate === null || f.gate === 'loading' || f.gate.status !== 'incomplete') return GOING_UNLOCKED;
  return { locked: true, reason: goingLockReason(missingFromGate(f.gate)), href: appWelcomeHref(f.returnTo) };
};

/**
 * A locked person can still REMOVE what they said before (the status read keeps
 * running): only a tap that would set a new status is blocked.
 */
export const goingTapLocked = (lock: GoingLock, current: string | null, target: string): boolean =>
  lock.locked && current !== target;

export const useGoingLock = (): GoingLock => {
  const { user } = useAuth();
  const area = useDancerArea();
  const gate = useContext(ProfileGateContext);
  const { pathname, search } = useLocation();
  return goingLockFor({
    signedIn: Boolean(user && !user.is_anonymous),
    organiser: hasOrganiserIntent(user?.user_metadata?.user_type),
    area,
    gate,
    returnTo: `${pathname}${search}`,
  });
};
