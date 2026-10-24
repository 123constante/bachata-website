/**
 * THE going words (Going P2). Every surface that says anything about "I'm
 * going" -- the event page tile, the festival hub rows, the calendar count, the
 * dancer app, the public dancer page and the settings switch -- reads its words
 * from here. No surface writes its own.
 *
 * Unicode punctuation is written as \u escapes (never pasted): the Cowork ->
 * Windows pipeline turns pasted punctuation into mojibake.
 *
 * Owner decisions this copy encodes: ONE "I'm going" button (no Interested);
 * going is for ONE night; only finished profiles may say going; the first name
 * always shows, the photo only when the dancer switched it on.
 */
// NO imports, on purpose: the calendar reads goingCountText from here on the
// first load of /parties and /classes. An import of src/lib/profileCompletion
// put that module (and auth-otp-routing behind it) on those pages too -- two
// more first-load requests (perf-budget chunk ratchet). The missing-field names
// are joined in goingState (unfinishedText); the words stay here.

const RSQ = '\u2019';
const DOT = '\u00b7';
const MDASH = '\u2014';
const ELLIPSIS = '\u2026';

export const GOING_COPY = {
  /** The tile heading (upcoming night / ended night). */
  tileTitle: `Who${RSQ}s going`,
  tileTitlePast: 'Who went',
  /** Accessible name of the tile. */
  tileLabel: `Who${RSQ}s going to this night`,

  /** The button. */
  go: `I${RSQ}m going`,
  going: `You${RSQ}re going ${DOT} Undo`,
  /** Going, on a night that is over: past tense (un-going stays allowed). */
  wentUndo: `You went ${DOT} Undo`,
  signIn: `Sign in to say you${RSQ}re going`,
  saving: `Saving${ELLIPSIS}`,
  /** The sign-in prompt a signed-out / guest tap opens. */
  signInTitle: `Say you${RSQ}re going`,
  signInBody: `Sign in or create a free account. Your first name shows on the nights you${RSQ}re going to.`,
  nightEnded: 'Night ended',
  nightCancelled: 'Night cancelled',

  /** The line under the button, per state. */
  goingUndoHint: `Changed your mind? Tap the button again to undo.`,
  /** The commonest state (shape survey: every upcoming night has 0 going). */
  beFirst: `Be the first ${MDASH} tap I${RSQ}m going and your first name shows here.`,
  signedOut: `It${RSQ}s free: sign in, finish your dancer profile, and your first name shows here.`,
  anonymous: `You${RSQ}re browsing as a guest. Sign in with a free account to say you${RSQ}re going.`,
  noProfile: `Your account has no dancer profile yet, so you can${RSQ}t say you${RSQ}re going.`,
  noProfileLink: 'Message us on WhatsApp',
  unfinishedGeneral: `Finish your dancer profile to say you${RSQ}re going.`,
  finishLink: 'Finish your profile',
  ended: 'This night is over.',
  endedGoing: `This night is over. You said you were going.`,
  cancelled: 'The organiser cancelled this night.',
  cancelledGoing: `The organiser cancelled this night. You can take your name off.`,
  notLive: `This event isn${RSQ}t taking names right now.`,
  notLiveGoing: `This event isn${RSQ}t taking names right now. You can take your name off.`,
  rateLimited: `You${RSQ}ve changed this a few times. Wait a minute, then try again.`,
  network: `Couldn${RSQ}t save. Check your connection and try again.`,
  notFound: `We couldn${RSQ}t find this night. Refresh the page and try again.`,
  error: 'Something went wrong. Please try again.',
  loading: `Checking${ELLIPSIS}`,
  peopleLoadFailed: `Couldn${RSQ}t load who${RSQ}s going.`,
  /** The viewer's own list (get_my_going_v1) failed: going is unknown, never "not going". */
  mineLoadFailed: `Couldn${RSQ}t check if you${RSQ}re going.`,
  retry: 'Try again',

  /** Settings switch (dancer app Edit / Options). */
  photoSwitchLabel: `Show my photo when I${RSQ}m going`,
  photoSwitchLine: `Your first name always shows on nights you${RSQ}re going to. This adds your photo.`,

  /** Public dancer page "Going next". */
  goingNextTitle: 'Going next',
  seeAll: (n: number) => `See all ${n}`,

  /** Dancer app lists (get_my_going_v1). */
  myUpcomingTitle: `Nights you${RSQ}re going to`,
  myPastTitle: 'Nights you went to',
  myUpcomingEmpty: `You haven${RSQ}t said you${RSQ}re going to any nights yet.`,
  myUpcomingEmptyHow: `Find a night on the calendar, then tap I${RSQ}m going on its page.`,
  myPastEmpty: 'No past nights yet.',
  tagGoing: 'Going',
  tagWent: 'Went',
  tagCancelled: 'Cancelled',

  /** Organiser view (Going P3, get_my_event_going_v1): one event's upcoming nights. */
  orgSheetTitle: `Who${RSQ}s going`,
  orgNobody: `Nobody has said they${RSQ}re going yet`,
  orgCancelled: 'This date is cancelled',
  orgLoading: `Loading who${RSQ}s going${ELLIPSIS}`,
  orgNotSignedIn: `You${RSQ}re signed out. Sign in again to see who${RSQ}s going.`,
  orgSignIn: 'Sign in again',
  orgNotFound: `We couldn${RSQ}t find this event. Go back to your events and open it again.`,
  orgNotOrganiser: `Only this event${RSQ}s owner and managers can see who${RSQ}s going. Ask the owner to add you as a manager.`,

  /** Stats total (get_my_organiser_going_total_v1) at 0: the headline, then what the organiser can do. */
  orgTotalNone: 'No one going yet',
  orgTotalNoneHint: `Share your event link on WhatsApp or Instagram. When dancers say they${RSQ}re going to one of your nights, it counts here.`,
  /** A re-read failed while a total is on screen: it stays, with this note and Try again. */
  orgTotalStale: `Couldn${RSQ}t refresh. This may be out of date.`,
} as const;

/** organiserTotalText: the Stats total in words. */
export type OrganiserTotalText = {
  /** The whole line in one string (a host's aria-label or share text): "7 going across 4 nights" / "No one going yet". */
  text: string;
  /** The big number, grouped ("123,456"); null at 0 (the headline is words, never a bare 0). */
  figure: string | null;
  /** Beside / under the number: "going across 4 nights"; at 0 the headline itself. */
  label: string;
  /** The second line at 0 (what the organiser can do); null otherwise. */
  hint: string | null;
};

/**
 * The organiser's going total across their upcoming nights. The number is
 * going TAPS, not people (one dancer going to 3 nights counts 3), so the words
 * never say "people": "3 going across 1 night". 0 is "No one going yet" plus
 * what to do -- never "0 going across 0 nights". Cancelled nights are not in
 * the total and are never named. A total with no night (an inconsistent
 * reply) still names one night: a tap is always on a night.
 */
export const organiserTotalText = (total: { going_total: number; nights: number }): OrganiserTotalText => {
  const going = Math.max(0, Math.floor(total.going_total || 0));
  if (going === 0) return { text: GOING_COPY.orgTotalNone, figure: null, label: GOING_COPY.orgTotalNone, hint: GOING_COPY.orgTotalNoneHint };
  const nights = Math.max(1, Math.floor(total.nights || 0));
  const label = `going across ${nights} ${nights === 1 ? 'night' : 'nights'}`;
  const figure = going.toLocaleString('en-GB');
  return { text: `${figure} ${label}`, figure, label, hint: null };
};

/**
 * The organiser's count line for one night: "12 going", or the 0 words. A
 * cancelled night never says "0 going": "This date is cancelled", plus
 * "3 had said they were going" when anyone had.
 */
export const organiserNightText = (count: number, cancelled: boolean): string => {
  if (cancelled) {
    const had = goingCountText(count, false, true);
    return had === '' ? GOING_COPY.orgCancelled : `${GOING_COPY.orgCancelled} ${DOT} ${had}`;
  }
  return Math.max(0, Math.floor(count || 0)) === 0 ? GOING_COPY.orgNobody : goingCountText(count);
};

/**
 * "12 going" / "No one going yet"; past nights: "5 went" / "No one said they
 * were going" (nobody tapped; people may still have gone). A cancelled night
 * never invites ("yet") and is never "going": "3 had said they were going",
 * and '' (no line) at 0.
 */
export const goingCountText = (count: number, past = false, cancelled = false): string => {
  const n = Math.max(0, Math.floor(count || 0));
  if (cancelled) return n === 0 ? '' : `${n} had said they were going`;
  if (n === 0) return past ? 'No one said they were going' : 'No one going yet';
  return past ? `${n} went` : `${n} going`;
};

/** "+N more" after the faces; "" when nobody is left over. */
export const moreText = (extra: number): string => (extra > 0 ? `+${extra} more` : '');

/** Screen-reader name of the "+N more" chip. */
export const moreLabel = (extra: number): string =>
  extra === 1 ? 'and 1 more person' : `and ${extra} more people`;

/** The organiser list's last line when more are going than it lists: "And 50 more people". */
export const moreSentence = (extra: number): string =>
  extra === 1 ? 'And 1 more person' : `And ${extra} more people`;

/**
 * "Add your dance role to say you're going." -- `fields` is the missing fields
 * already named and joined (listFieldLabels); '' = the general line. Surfaces
 * call goingState's unfinishedText(missing), which does the naming.
 */
export const unfinishedWords = (fields: string): string =>
  fields === '' ? GOING_COPY.unfinishedGeneral : `Add your ${fields} to say you${RSQ}re going.`;

/** A person's link name: "Ana, dancer page". */
export const personLinkLabel = (firstName: string): string => `${firstName}, dancer page`;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/**
 * "Thursday 29 Oct \u00b7 9 PM" from a London wall clock, read AS STORED (never
 * `new Date()` on the stamp: it carries no zone). Full weekday names. A stamp
 * with no time gives the date alone; an unreadable one gives null.
 */
export const nightLine = (startsAtLocal: string | null | undefined): string | null => {
  const m = (startsAtLocal ?? '').match(NAIVE);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const weekday = WEEKDAY[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12)).getUTCDay()];
  const date = `${weekday} ${Number(d)} ${MONTH[Number(mo) - 1]}`;
  if (hh === undefined) return date;
  const h = Number(hh);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const time = mm === '00' ? `${h12} ${h < 12 ? 'AM' : 'PM'}` : `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
  return `${date} ${DOT} ${time}`;
};
