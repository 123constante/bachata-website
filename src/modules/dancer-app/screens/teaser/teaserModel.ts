/**
 * The post-pay teaser's pure parts (brief ticket-buyer-teaser, PR 2): when the read-only dancer
 * app shows, which paths it covers and its words. No React, no I/O: the matrix test reads these.
 * Flag-gated (flags.ticketTeaser, default OFF) and only ever on top of flags.publicTicketing.
 */

/** The four tab screens the teaser replaces with read-only twins. Tickets stays the existing screen. */
export const TEASER_PATHS: readonly string[] = ['/app/home', '/app/nights', '/app/me', '/app/options'];

/** The teaser shows for a person the dancer gate holds view-only (an unfinished profile), with both flags on. */
export const teaserActive = (opts: { teaserFlag: boolean; ticketingFlag: boolean; viewOnly: boolean }): boolean =>
  opts.teaserFlag && opts.ticketingFlag && opts.viewOnly;

export const TEASER_COPY = {
  finishTitle: 'Finish your profile',
  finishLine: 'Your ticket is bought. Next step: tell us what you are.',
  finishCta: 'What are you?',
  step: '1 of 4',
  stepSuffix: 'to finish your profile',
  ticketTitle: 'Your ticket',
  sheetTitle: 'Finish your profile to use this',
  sheetBody: 'It takes about a minute. Your ticket stays safe either way.',
  sheetContinue: 'Continue',
  sheetNotNow: 'Not now',
  locked: 'Locked',
  meName: 'Not set yet',
  meEmpty: 'Your profile starts here once you tell us what you are.',
} as const;

/** The locked rows per tab (labels only; each opens the one sheet). One list so Home / Me / Options never drift. */
export const LOCKED_ROWS = {
  home: [
    { title: 'Share my page', line: 'Send your page to friends' },
    { title: 'Plans', line: 'Say you are going to a night' },
    { title: 'Nights attended', line: 'Your numbers start after your first night' },
  ],
  me: [
    { title: 'Edit my profile', line: 'Name, city, how you dance' },
    { title: 'My page', line: 'How it looks and who visited' },
    { title: 'See my public page', line: 'What others see' },
  ],
  options: [
    { title: 'Share my page', line: 'Send your page to friends' },
    { title: 'My page', line: 'How it looks and who visited' },
    { title: 'Send feedback', line: 'What is missing?' },
    { title: 'Add to my phone home screen', line: 'Open it like an app' },
  ],
  nights: [{ title: 'Rate this night', line: 'Your past nights show here' }],
} as const;

/** "Your ticket" subtitle: the first ticket's date and type, or just the type. */
export const ticketLine = (typeName: string, dateLabel: string | null): string => (dateLabel ? `${dateLabel} · ${typeName}` : typeName);
