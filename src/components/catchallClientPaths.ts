/**
 * Every path pattern the client-rendered catchall (AnimatedRoutes) answers,
 * minus its "*" NotFound. The server never renders these pages, so this list is
 * how app/catchallGate.ts knows a catchall URL is a real page (200) rather than
 * the client 404 (real HTTP 404). tests/catchallClientPaths.test.ts fails if
 * this list and the <Route path=...> literals in AnimatedRoutes.tsx drift.
 */
export const CATCHALL_CLIENT_PATHS: readonly string[] = [
  '/',
  '/city/:slug/map',
  '/city/:slug/parties',
  '/city/:slug/classes',
  '/discounts',
  '/city/:slug/discounts',
  '/tonight',
  '/city/:slug/tonight',
  '/vendors',
  '/vendors/:id',
  '/raffles',
  '/raffle/win/:token',
  '/join/class/:token', // flags.organiserClassInvites; route only registered while on (flag off = client NotFound)
  '/claim/teacher/:token', // flags.organiserClassInvites
  '/claim/:token',
  '/start-organiser',
  '/videographers',
  '/dancers',
  '/teachers',
  '/city/:slug/teachers',
  '/all-profiles',
  '/djs',
  '/venues',
  '/city/:slug/venues',
  '/organisers',
  '/account',
  '/account/dancer',
  '/account/continue',
  '/account/attendance',
  '/account/my-tickets', // flags.publicTicketing; while off the client redirects to /
  '/account/settings',
  '/account/settings/ownership',
  '/account/settings/delete',
  '/account/deleted',
  '/privacy',
  '/privacy/raffle-data', // raffle privacy line (#2231); missing here = HTTP 404 on direct load
  '/tickets/thanks', // flags.publicTicketing; while off the client renders its NotFound
  '/terms',
  '/account/restore',
  '/account/new',
  '/account/series/:seriesId',
  '/account/party-chat/:chatId', // flag VITE_ENABLE_PARTY_CHAT; flag off the client redirects to /account
  '/account/team/:organiserId?',
  '/account/o/*',
  '/account/p3/*', // flags.organiserP3; while off the client renders its NotFound
  '/account/tickets/*', // retired: redirects to P3 while organiserTicketing + organiserP3; else NotFound
  '/account/areas',
  '/account/t/*',
  '/account/dj/*',
  '/ambassador/*',
  '/admin/organisers',
  '/admin/organisers/front-door',
  '/invite',
  '/invite/:token',
  '/raffle/door/:token',
  '/door/join',
  '/door/join/:token',
  '/door/:seriesId',
  '/join/a/:code',
  '/auth',
  '/auth/callback',
  '/finish-profile',
  '/erase/:token',
  '/export/:token',
  '/search',
  '/city/:slug/search',
  // The dancer area: AnimatedRoutes mounts it as ONE <Route path="/app/*">, and
  // these are the concrete paths its own table answers
  // (modules/dancer-app/shell/routes.ts DANCER_APP_PATHS; the test pins them
  // equal). Listed one by one, not as /app/*, so an unknown /app/x is a real 404.
  '/app',
  '/app/welcome',
  '/app/home',
  '/app/nights',
  '/app/me',
  '/app/me/edit',
  '/app/tickets',
  '/app/page',
  '/app/me/photo',
  '/app/options',
  '/app/party-chat/:chatId',
];
