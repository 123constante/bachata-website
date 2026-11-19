import { flags } from '@/lib/featureFlags';
import { P3_PATHS } from './paths';

const NEW_PREFIX = P3_PATHS.newWhat.replace(/what$/, '');
const CREATE = P3_PATHS.create;
const isCreate = (pathname: string) => pathname === CREATE || pathname.startsWith(`${CREATE}/`) || pathname.startsWith(NEW_PREFIX);
const ORGANISERS = new RegExp(`^${P3_PATHS.events}/[^/]+/organisers/?$`);
// Slice 3: the read-only Who is in / Who came sheets are pushed (no tab bar).
const SHEETS = new RegExp(`^${P3_PATHS.events}/[^/]+/(in|came/[^/]+)/?$`);
const isSheet = (pathname: string) => flags.organiserDash && SHEETS.test(pathname);

/** An R1 screen in P3's frame (the You hub's pushes, New event, an event's Organisers): it draws its own top bar, with the way back. */
export function isPushed(pathname: string): boolean {
  if (isCreate(pathname) || ORGANISERS.test(pathname) || pathname === P3_PATHS.compare || isSheet(pathname)) return true;
  return pathname.startsWith(`${P3_PATHS.you}/`) && pathname !== `${P3_PATHS.you}/`;
}
