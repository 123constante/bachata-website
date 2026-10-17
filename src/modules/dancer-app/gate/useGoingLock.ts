import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfileGateContext, useAuth, type ProfileGateValue } from '@/hooks/useAuth';
import { appWelcomeHref, hasOrganiserIntent } from '@/lib/accountRouting';
import { PROFILE_FIELDS, type ProfileField } from '@/lib/profileCompletion';
import { NEXT_STEP } from '../api/nextStep';
import type { StrengthStep } from '../api/types';
import { useDancerArea, type DancerAreaState } from './useDancerArea';

/**
 * The Going / Interested lock (B1b S1, PLAN C14). A person inside the dancer
 * area whose profile is not finished is asked to finish it before saying they
 * are going or interested: the buttons are disabled, say why, and link to the
 * onboarding.
 *
 * This lock is BROWSER-ONLY (owner decision 2026-10-17). The server does NOT
 * refuse an incomplete profile's RSVP: neither set_my_occurrence_attendance_p5_v1
 * (event page) nor set_attendance (festival hub) checks completeness; only the
 * button does. A direct call, or a tap while this is unsure, goes through.
 *
 * Reads useDancerArea() and ProfileGateContext only -- no request of its own.
 * Every doubt (loading, error, signed out, not in the area, organiser-type, no
 * dancer profile) is UNLOCKED: today's buttons, which then save as before.
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

/**
 * Which fields the published gate says are missing, read from the gate's own
 * data (ProfileGateValue.missing), in profile order -- never from its display
 * text, so rewording the rating card cannot lose a step. null = it names none
 * (then the reason is the general one).
 */
export const missingFromGate = (gate: ProfileGateValue): ProfileField[] | null => {
  const missing = PROFILE_FIELDS.filter((f) => gate.missing?.includes(f));
  return missing.length > 0 ? missing : null;
};

/** Interested is locked too, so the words name both. */
const LOCK_TAIL = "to say you're going or interested";

/** "Add your photo to say you're going or interested" -- the next missing step's own words (api/nextStep). */
export const goingLockReason = (missing: readonly ProfileField[] | null): string => {
  if (!missing || missing.length === 0) return `Finish your profile ${LOCK_TAIL}`;
  const next = NEXT_STEP[FIELD_STEP[missing[0]]].label;
  return missing.length === 1 ? `${next} ${LOCK_TAIL}` : `${next} and a few details ${LOCK_TAIL}`;
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
