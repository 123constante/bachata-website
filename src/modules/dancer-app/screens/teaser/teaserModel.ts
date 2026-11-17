/**
 * The post-pay teaser's pure parts (brief ticket-buyer-teaser, PR 2): when the read-only dancer
 * app shows, which paths it covers and its words. No React, no I/O: the matrix test reads these.
 * Flag-gated (TICKET_TEASER_ENABLED, default OFF) and only ever on top of flags.publicTicketing.
 */

// The gate parts live in ./teaserGate (shell + gate import them without pulling this copy module into the dancer-app entry chunk).
export { TEASER_PATHS, teaserActive } from './teaserGate';

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
export const ticketLine = (typeName: string, dateLabel: string | null): string => (dateLabel ? `${dateLabel} \u00B7 ${typeName}` : typeName);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "Saturday 21 November 2026" for a YYYY-MM-DD night, same words as the door view's date (tickets/cardKit doorDate).
 * Its own copy ON PURPOSE: cardKit belongs to the lazy TicketCard chunk, and importing it here would make it a
 * module shared with the dancer-app chunk, which drops the /app/* row from the bundle-budget manifest.
 */
export const nightDate = (date: string | null): string | null => {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Home greeting: the first name from auth user metadata (no member RPC), else "Hi there". */
export const greetingFor = (meta: Record<string, unknown> | null | undefined): string => {
  const n = meta && typeof meta.first_name === 'string' ? meta.first_name.trim() : '';
  return n ? `Hi ${n}` : 'Hi there';
};

/** Where Continue returns to after onboarding: the dancer home (same value as DANCER_HOME; kept here so the lazy teaser chunk imports nothing from the shell). */
export const TEASER_HOME = '/app/home';
