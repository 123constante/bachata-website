// Paths of the person areas (people arc, pinned interface 5). One source for links, routes and sign-in landing.
export const AREA_PATHS = {
  areas: '/account/areas',
  teacher: '/account/t',
  dj: '/account/dj',
} as const;

export type AreaKey = keyof typeof AREA_PATHS;
