import { FINISH_PROFILE_PATH } from '@/lib/profileCompletion';
import type { Role } from './fieldRegistry';

// Module-local defaults only. Route wiring (AnimatedRoutes, src/lib/areaPaths.ts)
// belongs to slice B-WEB3, which passes its own paths as props.
export const DEFAULT_AREA_PATHS: Record<Role, { area: string; profile: string; back: string }> = {
  teacher: { area: '/account/teacher', profile: '/account/teacher/details', back: '/account' },
  dj: { area: '/account/dj', profile: '/account/dj/details', back: '/account' },
};

/** Where a person with no dancer profile finishes it (the real route: /finish-profile, whose no-profile page has the next step). */
export const DANCER_PROFILE_PATH = FINISH_PROFILE_PATH;
/** Where a signed-out person signs in. */
export const SIGN_IN_PATH = '/auth';
