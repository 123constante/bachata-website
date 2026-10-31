// THE state -> text/controls mapping for the S5 public door ("I run events"). Pure: no React, no Supabase.
// Every screen reads its words and buttons from here, so a result code cannot say two different things on
// two screens. Contract: admin repo docs/db-contracts.md "Organiser front door S5 public door".
// Punctuation is written as entities/escapes (the Cowork -> FUSE pipeline corrupts raw glyphs).
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';
import type { StartCode, StartOutcome, LookalikeState } from './doorParse';
export { START_CODES, LOOKALIKE_MAX, parseLookalikes, parseStartResult } from './doorParse';
export type { StartCode, StartOutcome, Lookalike, LookalikeState } from './doorParse';

export const DOOR_PATH = '/run-events';
export const TERMS_PATH = '/terms';
export const PRIVACY_PATH = '/privacy';
export const FINISH_PROFILE_PATH = '/finish-profile';
const APOS = '’';

/** The Website-side switch. Unset (the default) = closed page, whatever the database says. */
export const doorIsOn = (value: string | undefined): boolean => value === 'on';
/** The Turnstile widget renders only for a non-empty site key; unset = sign-in behaves exactly as before. */
export const turnstileSiteKey = (value: string | undefined): string | null => (value && value.trim() ? value.trim() : null);

const env = import.meta.env as Record<string, string | undefined>;
// Vite only exposes VITE_* to the client, so the brief's NEXT_PUBLIC_* names are read as VITE_*.
export const DOOR_ENV_VALUE = env.VITE_ORGANISER_DOOR;
export const TURNSTILE_ENV_VALUE = env.VITE_TURNSTILE_SITE_KEY;

// ---- a button or link on a result screen ---------------------------------------------------------
export type DoorAction =
  | { kind: 'link'; label: string; to: string; primary?: boolean; external?: boolean }
  | { kind: 'retry'; label: string; primary?: boolean };

const BROWSE: DoorAction = { kind: 'link', label: 'Browse events', to: '/' };
const MESSAGE_US: DoorAction = { kind: 'link', label: 'Message us', to: WHATSAPP_GET_LISTED_URL, external: true };
const SIGN_IN: DoorAction = { kind: 'link', label: 'Sign in to your page', to: `/auth?returnTo=${encodeURIComponent(ORG_PATHS.home)}` };

/** Things anyone can do while the door is shut or their turn has not come. Never empty. */
export const CAN_DO_NOW: readonly DoorAction[] = [BROWSE, MESSAGE_US, SIGN_IN];

export type Screen = { title: string; body: string; actions: readonly DoorAction[] };

export const CLOSED_SCREEN: Screen = {
  title: `Listing yourself isn${APOS}t open yet`,
  body: `We${APOS}re not taking new organiser pages just yet. You can still browse what${APOS}s on, message us if you run events and want to be listed, or sign in if you already have a page.`,
  actions: [{ ...BROWSE, primary: true } as DoorAction, MESSAGE_US, SIGN_IN],
};

// ---- organiser_start_v1 --------------------------------------------------------------------------
const MISSING_WORDS: Record<string, string> = { first_name: 'your first name', city: 'your city', dance_role: 'your dance role', photo: 'a photo' };
/** "your first name, your city and a photo". Unknown or empty = "a few details". */
export function missingSentence(missing: readonly string[]): string {
  const words = missing.map((m) => MISSING_WORDS[m]).filter(Boolean);
  if (words.length === 0) return 'a few details';
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export const pagePath = (organiserId: string): string => `/organisers/${encodeURIComponent(organiserId)}`;

/** Result -> screen. `null` = stay on the form (the code is an input mistake the form shows inline). */
export type StartView =
  | { kind: 'screen'; tone: 'good' | 'neutral'; screen: Screen }
  | { kind: 'closed' }
  | { kind: 'inline'; message: string };

const RETRY: DoorAction = { kind: 'retry', label: 'Try again', primary: true };

export function startView(o: StartOutcome): StartView {
  const yourPage = (id: string | null): DoorAction[] => (id ? [{ kind: 'link', label: 'See your page', to: pagePath(id), primary: true }] : [BROWSE]);
  switch (o.code) {
    case 'CREATED':
      return { kind: 'screen', tone: 'good', screen: {
        title: `Your page is live`,
        body: `Done. People can find you now. Add your first event so there${APOS}s something on it.`,
        actions: [
          { kind: 'link', label: 'Add your first event', to: ORG_PATHS.newWhat, primary: true },
          ...(o.organiserId ? [{ kind: 'link', label: 'See your page', to: pagePath(o.organiserId) } as DoorAction] : []),
        ],
      } };
    case 'ALREADY_EXISTS':
      return { kind: 'screen', tone: 'good', screen: {
        title: `You${APOS}ve already started this page`,
        body: `Nothing new was made. Your page is live and ready for events.`,
        actions: [...yourPage(o.organiserId), { kind: 'link', label: 'Add an event', to: ORG_PATHS.newWhat }],
      } };
    case 'ALREADY_HAS_PAGE':
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `You already have a page`,
        body: `Each person can start one page here. Yours is live; you can add events to it, or message us if you need another.`,
        actions: [...yourPage(o.organiserId), MESSAGE_US],
      } };
    case 'DOOR_CLOSED':
      return { kind: 'closed' };
    case 'NOT_ON_LIST':
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `Not quite your turn yet`,
        body: `We${APOS}re letting organisers in a few at a time, and we will tell you when it is your turn. Meanwhile you can browse events, message us, or sign in if you already have a page.`,
        actions: [{ ...BROWSE, primary: true } as DoorAction, MESSAGE_US, SIGN_IN],
      } };
    case 'EMAIL_DOMAIN_NOT_ALLOWED':
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `Please use your own email address`,
        body: `We can${APOS}t start a page from a temporary or shared address. Sign out and come back with the email you really use.`,
        actions: [{ kind: 'link', label: 'Sign out and start again', to: `/auth?returnTo=${encodeURIComponent(DOOR_PATH)}`, primary: true }, MESSAGE_US],
      } };
    case 'EMAIL_NOT_VERIFIED':
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `Please confirm your email first`,
        body: `We need to know the email is yours. Ask for a new code and enter it, then you can start your page.`,
        actions: [{ kind: 'link', label: 'Get a new code', to: `/auth?returnTo=${encodeURIComponent(DOOR_PATH)}`, primary: true }, MESSAGE_US],
      } };
    case 'PROFILE_INCOMPLETE':
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `One quick thing first`,
        body: `Before your page can go live we need ${missingSentence(o.missing)} on your profile. Add it, then you${APOS}ll come straight back here to finish.`,
        actions: [{ kind: 'link', label: 'Finish my profile', to: `${FINISH_PROFILE_PATH}?returnTo=${encodeURIComponent(DOOR_PATH)}`, primary: true }, BROWSE],
      } };
    case 'NOT_SIGNED_IN':
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `Please sign in again`,
        body: `Your sign-in has run out. Sign in with your email code and you${APOS}ll land back here.`,
        actions: [{ kind: 'link', label: 'Sign in', to: `/auth?returnTo=${encodeURIComponent(DOOR_PATH)}`, primary: true }, BROWSE],
      } };
    case 'NAME_REQUIRED': return { kind: 'inline', message: `Add the name your events run under.` };
    case 'CITY_REQUIRED': return { kind: 'inline', message: `Choose the city you run events in.` };
    case 'CITY_NOT_FOUND': return { kind: 'inline', message: `We couldn${APOS}t find that city. Pick one from the list, or message us if yours is missing.` };
    case 'NAME_TAKEN': return { kind: 'inline', message: `That name is already in use. Try a slightly different one, or check the pages below.` };
    case 'NAME_TOO_LONG': return { kind: 'inline', message: `That name is a bit long. Please shorten it.` };
    case 'NAME_INVALID': return { kind: 'inline', message: `That name has characters we can${APOS}t use. Letters and numbers work best.` };
    case 'DAILY_LIMIT': return { kind: 'screen', tone: 'neutral', screen: {
      title: `That’s enough for today`,
      body: `Please try again tomorrow, or message us and we will help.`,
      actions: [{ ...BROWSE, primary: true } as DoorAction, MESSAGE_US],
    } };
    case 'INVALID_PAYLOAD':
    case 'unknown':
    default:
      return { kind: 'screen', tone: 'neutral', screen: {
        title: `Something went wrong on our side`,
        body: `Nothing was lost. Please try again in a moment, or message us if it keeps happening.`,
        actions: [RETRY, MESSAGE_US],
      } };
  }
}

// ---- organiser_lookalikes_v1 ---------------------------------------------------------------------
export const RATE_LIMITED_TEXT = 'Try again in a little while';
export const LOOKALIKE_TEXT = {
  heading: 'Is this you?',
  yes: `Yes, that${APOS}s mine`,
  yesHelp: `Pages are joined by signing in with the email the page owner used, or by asking the team. Nothing is claimed here.`,
  no: 'No, create a new page',
  error: `We couldn${APOS}t check for similar pages just now. You can still go ahead.`,
};

// ---- the forms -----------------------------------------------------------------------------------
/** Submit works once both fields are filled and nothing is in flight; the reason is said under the button otherwise. */
export function startFormState(name: string, cityId: string, busy: boolean): { canSubmit: boolean; why: string | null } {
  if (busy) return { canSubmit: false, why: 'Starting your page…' };
  if (!name.trim()) return { canSubmit: false, why: 'Add your organiser name to continue.' };
  if (!cityId) return { canSubmit: false, why: 'Choose your city to continue.' };
  return { canSubmit: true, why: null };
}

/** Lookalikes are asked only for a real name + city, never on an untouched form. */
export const shouldAskLookalikes = (name: string, cityId: string): boolean => name.trim().length >= 2 && Boolean(cityId);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The email box: why the send button is off, in words. */
export function emailFormState(email: string, busy: boolean, needsToken: boolean, hasToken: boolean): { canSend: boolean; why: string | null } {
  if (busy) return { canSend: false, why: 'Sending…' };
  if (!EMAIL_RE.test(email.trim())) return { canSend: false, why: 'Enter your email address to continue.' };
  if (needsToken && !hasToken) return { canSend: false, why: 'Tick the box above to show you are a person.' };
  return { canSend: true, why: null };
}

export const DOOR_COPY = {
  title: 'I run events',
  who: `For anyone who runs bachata nights, classes or festivals and wants their own page on Bachata Calendar.`,
  stepsHeading: 'How it works',
  steps: ['Enter your email and we send you a code.', 'Tell us your organiser name and city.', `Your page goes live straight away. Add your first event.`],
  send: 'Send me a code',
  terms: { lead: 'By continuing you agree to the', terms: 'Terms', and: 'and', privacy: 'Privacy' },
  codeSent: (email: string) => `We${APOS}ve emailed a code to ${email}. It can take a minute; check your spam folder too.`,
  start: { title: 'Start your page', nameLabel: 'Organiser name', cityLabel: 'City', submit: 'Create my page' },
};
