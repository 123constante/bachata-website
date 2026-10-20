import type { Role } from './fieldRegistry';

// Module-local defaults only. Route wiring (AnimatedRoutes, src/lib/areaPaths.ts)
// belongs to slice B-WEB3, which passes its own paths as props.
export const DEFAULT_AREA_PATHS: Record<Role, { area: string; profile: string; back: string }> = {
  teacher: { area: '/account/teacher', profile: '/account/teacher/details', back: '/account' },
  dj: { area: '/account/dj', profile: '/account/dj/details', back: '/account' },
};
