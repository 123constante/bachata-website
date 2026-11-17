/** The teaser's pure gate parts (see teaserModel.ts for the rest). */

/** The four tab screens the teaser replaces with read-only twins. Tickets stays the existing screen. */
export const TEASER_PATHS: readonly string[] = ['/app/home', '/app/nights', '/app/me', '/app/options'];

/** The teaser shows for a person the dancer gate holds view-only (an unfinished profile), with both flags on. */
export const teaserActive = (opts: { teaserFlag: boolean; ticketingFlag: boolean; viewOnly: boolean }): boolean =>
  opts.teaserFlag && opts.ticketingFlag && opts.viewOnly;
