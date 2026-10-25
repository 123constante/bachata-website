// One string per fact that shows on more than one screen (audit M16, L13).
// Every dancer-app screen imports from here; never copy a value into a screen.
//
// The VALUES live in src/lib/accountRouting.ts (the site's account pages show the same
// facts and must not import this module; and a module of its own here became its own
// first-load chunk on /app/*). This file is the dancer app's name for them: re-exports, plus
// the facts only the dancer app shows (FIND_A_NIGHT).
export { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_LINE, HIDDEN_STATE_WORD, SHOW_AGAIN_LABEL } from '@/lib/accountRouting';

/**
 * Review S9: the ONE "find a night" sentence (Home next-night card, Nights empty states, the lineup empty state).
 * Dancer-app only, so it lives here. D130: no Browse events button in /app/*; the way on is the home link top left.
 */
export const FIND_A_NIGHT = 'Find a night with the Bachata Calendar link at the top left.';
