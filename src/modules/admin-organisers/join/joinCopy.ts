// THE copy module for the /invite join journey (PLAN.md section 3 copy rule): plain English, one
// place per screen, and every error says what the person can do next -- never a raw code. Unicode
// punctuation is written as \u escapes (right quote, ellipsis): the Cowork -> FUSE -> NTFS pipeline corrupts raw glyphs.
import { OTP_RATE_LIMITED_MESSAGE, SIGNUP_HELP_WHATSAPP_URL } from '@/lib/auth-otp-routing';

const APOS = '\u2019';
const ELLIPSIS = '\u2026';

/** The person who sent the link, for "Ask <inviter>" wording. */
export const inviterName = (inviter: string | null | undefined): string => (inviter?.trim() ? inviter.trim() : 'the person who sent it');

export const PROGRESS_LABELS = { email: 'Your email', about: 'About you', join: 'Join' } as const;

export const JOIN_COPY = {
  pageTitle: (org: string) => `Join ${org} on Bachata Calendar`,
  strip: (inviter: string | null, org: string) => (inviter ? `${inviter} invited you to manage ${org}` : `You were invited to manage ${org}`),
  checking: 'Checking your link' + ELLIPSIS,

  // Person-bound invite card (linking prototype: "Hi Papacito").
  person: {
    hi: (first: string) => `Hi ${first}`,
    tag: 'This is your profile',
    body: 'This is your profile on Bachata Calendar. Joining links it to your email, with everything already on it.',
  },

  email: {
    heading: 'Your email',
    label: 'Your email',
    hint: `We${APOS}ll send you an 8-digit code. No password needed.`,
    button: 'Send my code',
    sending: 'Sending' + ELLIPSIS,
    why: 'Type your email to get a code.',
    badShape: 'Use an email like name@example.com.',
    notAscii: 'Please type the address with plain letters and numbers only.',
  },

  code: {
    heading: 'Type your code',
    sentTo: (email: string) => `Sent to ${email}. It can take a minute.`,
    label: '8-digit code',
    change: 'Wrong email? Change it',
    resend: 'Resend code',
    resendIn: (s: number) => `Resend code in ${s}s`,
    resent: 'New code sent. Check your email.',
    verifying: 'Checking code' + ELLIPSIS,
    wrong: 'That code is wrong or has run out. Check the email, or get a new code.',
    rateLimited: OTP_RATE_LIMITED_MESSAGE,
    resendFailed: `We couldn${APOS}t send a new code. Check your connection and try again.`,
    linking: 'Signing you in' + ELLIPSIS,
  },

  about: {
    heading: 'A bit about you',
    lead: `Four things, then you${APOS}re in. You can add more later.`,
    linked: 'Linked to your existing profile.',
    missing: (n: number) => (n === 1 ? 'Just one thing missing' : `Just ${n} things missing`),
    stillToAdd: (fields: string) => `Still to add: ${fields}.`,
    button: 'Continue',
    saving: 'Saving' + ELLIPSIS,
    saveFailed: `We couldn${APOS}t save that. Check your connection and try again.`,
    firstName: 'First name',
    city: 'Your city',
    cityPlaceholder: 'Choose your city' + ELLIPSIS,
    role: 'Dance role',
    photo: 'Photo',
    photoHint: 'Head and shoulders. People see it next to your events.',
  },

  join: {
    heading: (org: string) => `Join ${org}?`,
    card: (org: string) => `You${APOS}ll be able to add and edit ${org}${APOS}s events and manage its page.`,
    button: (org: string) => `Join ${org}`,
    joining: 'Joining' + ELLIPSIS,
    notYou: 'Not you? Use another email',
  },

  done: {
    heading: (org: string) => `You${APOS}re on ${org}${APOS}s team.`,
    body: 'Everything on its page is yours to use: events, team and profile.',
    button: 'Open your organiser home',
    // F-05: while P3 is live the button lands on P3's Welcome for the page (or P3's Home without
    // an id), both inside the organiser area -- so it says the area, not "home".
    buttonP3: 'Open your organiser area',
    // organiserSelfServe off: the organiser area is not open yet, so the one next step is the public site.
    bodyOff: 'Your place on the team is saved for when they open.',
    buttonOff: 'Go to Bachata Calendar',
  },

  wrongAccount: {
    heading: 'This link is for a different email',
    body: (signedInAs: string, hint: string) => `You${APOS}re signed in as ${signedInAs}. This invite is for ${hint}.`,
    button: 'Sign out and continue',
  },

  // Safety stop (linking prototype). "We've told" is real: the server records the not_linked attempt.
  notLinked: {
    tag: 'Paused',
    heading: `We couldn${APOS}t join your profiles automatically`,
    body: (inviter: string | null) => `We${APOS}ve told ${inviterName(inviter)}, who will sort it out and let you know.`,
    note: 'Your invite stays open. You can use this link again afterwards.',
    button: 'Try a different email',
  },

  // Refusal screens (no prototype; written to the copy rule).
  blockedDomain: {
    heading: `We can${APOS}t send a code to this email`,
    body: `Sign-up with this email provider isn${APOS}t accepted. Use another email address, or message us and we${APOS}ll help.`,
    help: 'Message us on WhatsApp',
    helpUrl: SIGNUP_HELP_WHATSAPP_URL,
    button: 'Use another email',
  },
  rateLimited: {
    heading: 'Too many tries',
    bodyCode: OTP_RATE_LIMITED_MESSAGE,
    // The post-Join (redeem) limit's words and its disabled Try again live in REDEEM_COPY.rate_limited: one copy.
    button: 'Try again',
  },
  // The help link a refusal screen shows when REDEEM_COPY marks the reason `help` (team_full).
  help: { label: 'Message us on WhatsApp', url: SIGNUP_HELP_WHATSAPP_URL },
  network: {
    heading: 'Something went wrong',
    body: `We couldn${APOS}t reach Bachata Calendar. Check your connection and try again.`,
    button: 'Try again',
  },
  emailUnproven: {
    heading: 'Sign in with a code to continue',
    body: `You signed in another way, so we can${APOS}t confirm this email is yours. Sign out, then sign in with the code we email you.`,
    button: 'Sign out and get a code',
  },
  alreadyBound: {
    heading: 'This link is tied to another email',
    body: (inviter: string | null) => `Someone already used this link with a different email. Ask ${inviterName(inviter)} for a new link.`,
  },
  noProfile: {
    heading: `Your account has no dancer profile yet`,
    body: `So it can${APOS}t join a team. Message us on WhatsApp and we${APOS}ll sort it out.`,
    help: 'Message us on WhatsApp',
    helpUrl: SIGNUP_HELP_WHATSAPP_URL,
  },

  signOutFailed: 'You are still signed in. Check your connection and try again.',
  home: 'Go to Bachata Calendar',
} as const;
