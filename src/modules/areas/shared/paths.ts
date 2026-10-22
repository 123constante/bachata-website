import { AREA_PATHS } from '@/lib/areaPaths';
import { FINISH_PROFILE_PATH } from '@/lib/profileCompletion';
import type { Role } from './fieldRegistry';

// Defaults from the one path list (src/lib/areaPaths.ts). AreaRoutes (B-WEB3)
// passes the same paths as props.
export const DEFAULT_AREA_PATHS: Record<Role, { area: string; profile: string; back: string }> = {
  teacher: { area: AREA_PATHS.teacher, profile: `${AREA_PATHS.teacher}/details`, back: AREA_PATHS.areas },
  dj: { area: AREA_PATHS.dj, profile: `${AREA_PATHS.dj}/details`, back: AREA_PATHS.areas },
};

/** Where a person with no dancer profile finishes it (the real route: /finish-profile, whose no-profile page has the next step). */
export const DANCER_PROFILE_PATH = FINISH_PROFILE_PATH;
/** Where a signed-out person signs in. */
export const SIGN_IN_PATH = '/auth';
