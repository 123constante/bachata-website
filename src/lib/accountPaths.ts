/**
 * The account area's base path and its predicate: an import-free leaf, so the site header can
 * read them on every route without loading lib/accountRouting (and the `lib-account` chunk with
 * the avatar that rides it). Review #789 S6. lib/accountRouting re-exports both.
 */
export const ACCOUNT_HOME_PATH = '/account';

/** True on every page the account icon stands for (dancer home, attendance, organiser area). */
export const isAccountPath = (pathname: string): boolean =>
  pathname === ACCOUNT_HOME_PATH || pathname.startsWith(`${ACCOUNT_HOME_PATH}/`);
