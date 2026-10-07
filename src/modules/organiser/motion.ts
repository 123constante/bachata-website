/**
 * One timing everywhere in the organiser area: 0.3s ease-in-out, no bounce.
 * Components read these instead of inventing their own numbers.
 */
export const MOTION_MS = 300;
export const MOTION_EASE = 'ease-in-out';
export const MOTION_TRANSITION = `${MOTION_MS}ms ${MOTION_EASE}`;

// Reused as-is from the old module (not copied): one source of truth.
export { usePrefersReducedMotion } from '@/modules/organiser-self-serve/components/usePrefersReducedMotion';
