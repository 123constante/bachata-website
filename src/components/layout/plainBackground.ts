// D84: the routes that sit inside the public site frame but belong to the
// organiser journey, so they use the organiser area's plain dark surface
// (#0f0d0b, the same as .org-theme --bg) instead of the purple doodle wash.
// ONE list; GlobalLayout reads it. The public site keeps its look everywhere else.
export const PLAIN_BACKGROUND_ROUTES: readonly string[] = ['/invite', '/admin/organisers'];

/** True for a route in PLAIN_BACKGROUND_ROUTES or below it (`/invite/<token>`). */
export const isPlainBackgroundPath = (pathname: string): boolean =>
  PLAIN_BACKGROUND_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

export const PLAIN_BACKGROUND_COLOR = '#0f0d0b';
