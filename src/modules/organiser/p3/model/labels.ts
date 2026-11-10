import type { P3Kind, RoleKey, SessionKind } from './types';

/**
 * The single label list `L` (C3.md "Shared labels", C2's kept). Every P3
 * screen reads its words from here; never type one of these in a component.
 * Plain text: punctuation is written as \u escapes, never pasted Unicode
 * (CLAUDE.md, HTML entities over raw Unicode).
 */
// Words used in two places in L, written once.
const SKIP = 'Skip this week (break)';
const UNSKIP = 'Put this week back';
const BRING_BACK = 'Bring it back';
const CANCEL_EVENT = 'Cancel the event';
const RESET_DATE = 'Put this date back to normal';

export const L = {
  tabs: { home: 'Home', events: 'Events', stats: 'Stats', you: 'You' },

  /** Slice 1a: the role strip at the top of every P3 screen, and the Switch page list. */
  /** Slice 1c: the Switch page's Add a profile card toast (P3-only copy; the R1 switch/ dir names no Undo). */
  addProfile: {
    hidden: 'Hidden. We will remember this.',
    /** Storage threw: hidden for this visit only, so it does not promise to remember. */
    hiddenSession: 'Hidden for now.',
    undo: 'Undo',
  },
  strip: {
    /** Owner or Manager only: the contributor role is gone and never named. */
    role: { owner: 'Owner', manager: 'Manager' } as Record<'owner' | 'manager', string>,
    switchWord: 'Switch',
    switchName: 'Switch page',
    todos: (n: number) => `${n} ${n === 1 ? 'to-do' : 'to-dos'} on your other pages`,
    pageTodos: (n: number) => `${n} ${n === 1 ? 'to-do' : 'to-dos'} on this page`,
    otherPages: 'Your other pages',
  },

  sessions: 'Sessions',
  everyDate: 'Every date',
  noName: 'No name yet',
  noSessions: 'No sessions yet',
  noTime: 'No time yet',
  fromTime: (t: string) => `From ${t}`,
  endsNextDay: 'ends the next day',
  /** C3's "What is it?" picker. */
  sessKind: [['class', 'Class'], ['workshop', 'Workshop'], ['party', 'Party'], ['show', 'Show']] as ReadonlyArray<readonly [SessionKind, string]>,
  /** Stored types the picker does not offer, still shown by name. */
  sessKindOther: [['masterclass', 'Masterclass'], ['performance', 'Performance'], ['competition', 'Competition']] as ReadonlyArray<readonly [SessionKind, string]>,
  roles: [['teach', 'Teaches'], ['dj', 'DJs'], ['perform', 'Performs']] as ReadonlyArray<readonly [RoleKey, string]>,
  /** The role as a noun after a name: [one, a pair or group]. */
  roleNoun: { teach: ['teacher', 'teachers'], dj: ['DJ', 'DJs'], perform: ['performer', 'performers'] } as Record<RoleKey, readonly [string, string]>,
  lvls: ['Beginners', 'Improvers', 'Intermediate', 'Advanced', 'All levels'],

  // one date
  onlyThis: 'Only this date',
  extra: 'Extra, this date only',
  notRunning: 'Not running this date',
  removeOne: 'Remove (only this date)',
  removeAll: 'Remove from every date',
  addSessOne: 'Add a session to this date only',
  addNext: 'Add the next session',

  // scope
  thisOnly: 'This date only',
  thisLater: 'This and later ones',
  scopeFrom: (day: string, what: string) => `Changes from ${day} onwards. Earlier dates keep the old ${what}.`,

  // skip / cancel
  skip: SKIP,
  skipped: 'Break',
  unskip: UNSKIP,
  cancelWhy: 'Why? (dancers see this)',

  // status
  live: 'Live',
  hidden: 'Hidden',
  finished: 'Finished',
  draft: 'Draft (only you see it)',
  endIt: 'This has finished (end it)',
  backDraft: 'Take it off the calendar (back to draft)',
  stopRepeat: 'Stop repeating, I will add dates myself',
  // the Status sheet (C3 `status`; Hide not Pause, C3 B3)
  putLive: 'Put it live',
  hide: 'Hide from the calendar',
  show: 'Show it again',
  remove: 'Remove this event',
  cancelEvent: CANCEL_EVENT,
  cancelEventWhy: 'It hasn\u2019t happened yet. Dancers see it as cancelled, with your reason.',
  bringItBack: BRING_BACK,
  sheetHint: 'Only the moves that work right now. Greyed ones say why.',

  // the event page (C3 event page, W2a)
  allEvents: 'All events',
  comingUp: 'Coming up',
  noComing: 'No dates coming up',
  about: 'About',
  ticket: 'Ticket link',
  instagram: 'Instagram',
  music: 'Music',
  notSet: 'Not set yet',
  noLineup: 'No line-up yet',
  ownChanges: 'Own changes',
  cancelled: 'Cancelled',
  allDone: 'All classes done',
  draftTag: 'Draft',
  noDatesYet: 'No dates yet',
  today: 'Today',
  tonight: 'Tonight',
  tomorrow: 'Tomorrow',
  views: 'views',
  going: 'going',

  // save
  saveOne: 'Save for this date',
  saveAll: 'Save for all dates',
  saveOneDateEvent: 'Save',
  notSaved: 'Not saved yet',
  undoMine: 'Undo my changes',

  // usual
  sameUsual: 'Same as usual',
  usually: 'Usually',
  useUsual: 'use usual',
  resetDate: RESET_DATE,

  // other
  makeCopy: 'Make a copy',
  history: 'History',
  share: 'Share',
  whosGoing: 'Who\u2019s going',
  moreOpts: 'More options',
  askCity: 'Ask us to change the city',
  checkedSoon: 'We check new venues within a day.',

  // dates (W2b: the date sheet and All dates; C3 `date`, `dtime`, `skip`, `resetdate`, `dayown`)
  /** Each date action: [title, what it does]. The rule set is model/dates.ts. */
  dateAct: {
    cancel: ['Cancel this date', 'Dancers see \u2018Cancelled\u2019 and your reason'],
    cancelEvent: [CANCEL_EVENT, 'Dancers see it as cancelled, with your reason'],
    bringBack: [BRING_BACK, 'Dancers see it on again'],
    move: ['Move to another day', 'The sessions keep their times'],
    time: ['Change the time on this date', 'Every session moves by the same amount'],
    resetTime: ['Back to the usual time', 'Only this date\u2019s time changes'],
    details: ['Different details this date', 'Where, about, ticket link, cover photo, name, photos, price'],
    resetNormal: [RESET_DATE, 'Where, about, ticket link, cover photo, name, photos, price and time go back to usual. Sessions stay as they are.'],
    skip: [SKIP, 'Not running that week. No notice, the date just isn\u2019t there'],
    unskip: [UNSKIP, 'Dancers see this date again'],
    remove: ['Remove this date', 'Take it off the list for good'],
  } as Record<'cancel' | 'cancelEvent' | 'bringBack' | 'move' | 'time' | 'resetTime' | 'details' | 'resetNormal' | 'skip' | 'unskip' | 'remove', readonly [string, string]>,
  datePick: {
    choose: 'Choose a date.',
    past: 'Choose a date from today on.',
    taken: 'This event already has a date on that day (a cancelled one counts too). Pick another day.',
  },
  allDates: 'All dates',
  seeAllDates: 'See all dates',
  addDate: 'Add a date',
  addThisDate: 'Add this date',
  done: 'Done',
  ownTime: 'Own time',
  notUsualDay: 'Not the usual day',
  moreForDate: 'More for this date',
  dateFilters: [['coming', 'Coming'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['breaks', 'Breaks'], ['own', 'Own changes']] as ReadonlyArray<readonly ['coming' | 'past' | 'cancelled' | 'breaks' | 'own', string]>,
  where: 'Where',
  aboutDate: 'About this event',
  photo: 'Photo',
  changeForDate: 'Change for this date',

  /** The shape names (create flow, Repeats row). Not the kind word: that is eventCategory's. */
  kind: {
    weekly: 'Weekly social',
    monthly: 'Monthly social',
    course: 'Course',
    oneoff: 'One-off party',
    custom: 'Dates I pick',
    festival: 'Festival',
  } as Record<P3Kind, string>,

  // sessions and line-up (W2d: C3 session sheet, line-up sheet, `removeall`, scope picker)
  newSession: 'New session',
  addSession: 'Add a session',
  whatIsIt: 'What is it?',
  sessName: 'Name',
  starts: 'Starts',
  ends: 'Ends',
  room: 'Room',
  level: 'Level',
  lineup: 'Line-up',
  changeLineup: 'Change line-up',
  saveLineup: 'Save line-up',
  nothingChanged: 'Nothing changed yet',
  nobodyYet: 'Nobody yet. Search below to add a teacher or a DJ.',
  whichDates: 'Which dates?',
  justDate: (day: string) => `Just ${day}`,
  everyDateSub: 'Every date coming up changes',
  justDateSub: 'Every other date stays as it is',
  addThisSession: 'Add this session',
  dontAdd: 'Don\u2019t add it',
  bringBackSess: 'Bring it back on this date',
  notRunningBody: (day: string) => `This session is not running on ${day}. Dancers see it struck through. The other dates keep it.`,
  notRunningNote: 'Not running keeps it on the list, struck through, so dancers know.',
  removeAllTitle: (name: string) => `Remove \u201c${name}\u201d from every date?`,
  removeAllBody: (n: number) => (n === 0 ? 'It comes off the programme. Dancers stop seeing it.' : `It comes off ${n === 1 ? 'the 1 date' : `all ${n} dates`} coming up. Dancers stop seeing it.`),
  removeAllHint: 'Only skipping it once? Open that date and choose \u201cNot running this date\u201d instead.',
  /** Under the scope picker once something is typed: switching scope starts again from that scope's stored session. */
  scopeClears: 'Changing which dates clears what you typed here.',
  removeAllYes: 'Yes, remove from every date',
  keepIt: 'Keep it',
  leaveOff: 'Leave it off',
  searchPeople: 'Find a person',
  searchHint: 'Type at least 2 letters of a name.',
  searchPlaceholder: 'Type a name, e.g. Sofia',
  peopleLoadFail: 'We couldn\u2019t search for people. Check your connection, then try again.',
  alreadyOn: (role: string) => `Already on as ${role}`,
  back: 'Back',
  namePlaceholder: 'e.g. Bachata Sensual, improvers',
  endsNextDayAt: (t: string) => `Ends the next day (${t}).`,
  lineupAfterAdd: 'Add people after you add the session.',
  noSessionsDate: 'No sessions on this date yet. Add one for this date only below.',
  removedTag: 'Removed',
  notRunningTag: 'Not running',
  extraTag: 'This date only',
  noMatch: 'Nobody found with that name. Check the spelling, or ask the Bachata Calendar team to add them.',
  addAs: 'Add as',
  takeOff: 'Take off',
  putBack: 'Keep them on',
  /** A stored person taken off shows in the search too: putting them back is the row's button, not a second add. */
  useKeepOn: 'Taken off above. Tap \u201cKeep them on\u201d to put them back.',
  readOnlyPerson: 'Set by the Bachata Calendar team',
  festivalAsk: 'Festival sessions are set with the Bachata Calendar team. Ask us to change the programme.',
  askUs: 'Ask us to change the programme',
  sessionsDate: 'Sessions this date',
  loadingSessions: 'Loading the sessions\u2026',
  sessionsLoadFail: 'We couldn\u2019t load this date\u2019s sessions. Check your connection, then try again.',
  /** Toasts after a programme write (saved/added words: saveWordsFor in saveWords.ts, by lifecycle). */
  removedEvery: 'Removed from every date.',
  removedDate: (day: string) => `Removed from ${day}.`,
  offDate: (day: string) => `Not running on ${day}. Dancers see it struck through.`,
  backDate: (day: string) => `Back on for ${day}.`,
  lineupSaved: (where: string) => `Line-up saved for ${where}.`,

  // ---- W3a: Name and details, Prices, and the shared save model (tray, Undo my changes, leave guard)
  detailsTitle: 'Name and details',
  detailsRowSub: 'Name, about, music, place, links, cover photo',
  detailsName: 'Event name',
  detailsNameNeeded: 'Add an event name',
  detailsTooLong: (n: number) => `Keep it under ${n.toLocaleString('en-GB')} characters.`,
  detailsAbout: 'About this event',
  detailsAboutHint: 'What should dancers know? For example: no partner needed, class first, then the party. Shown on every date; to change one date only, open that date.',
  detailsNone: 'none',
  detailsWhere: 'Where',
  detailsWhereNeeded: 'Pick a place: an event always has one.',
  detailsPickPlace: 'Change the place',
  detailsPlaceSheet: 'Pick the place',
  detailsPlaceLoading: 'Loading the places\u2026',
  detailsPlaceFail: 'We couldn\u2019t load the places. Check your connection, then try again.',
  detailsCityNote: 'The city comes from the place.',
  detailsCityBusy: 'Finding the place\u2019s city\u2026',
  detailsCityFail: 'We couldn\u2019t find the place\u2019s city. Check your connection, then try again.',
  detailsCityRetry: 'Try again',
  detailsCover: 'Cover photo',
  detailsCoverAdd: 'Add a cover photo',
  detailsCoverChange: 'Choose a new cover photo',
  detailsImageBroken: 'This picture did not load. Change it or remove it.',
  detailsCoverNone: 'No cover photo yet. Add one: dancers see it before anything else.',
  detailsUploading: 'Uploading the photo\u2026',
  detailsPictures: 'Pictures',
  detailsPicturesCount: (n: number) => (n ? `${n} ${n === 1 ? 'picture' : 'pictures'}` : 'None yet'),
  detailsPicturesHint: 'Pictures for the whole event, shown on its page. JPG, PNG or WebP.',
  detailsPicturesEmpty: 'No pictures yet. Add a few from past nights to show on the event page.',
  detailsPicturesAdd: 'Add pictures',
  detailsPicturesEdit: 'Change pictures',
  detailsPicturesRemove: 'Remove this picture',
  detailsPicturesDone: 'Done',
  detailsPicturesMax: (n: number) => `${n} pictures is the most an event can have. Remove one to add another.`,
  detailsPicturesFestival: 'A festival\'s pictures are set by the Bachata Calendar team. Ask them to change them.',
  detailsVideos: 'Videos',
  detailsVideosHint: 'One link per line, starting with https://',
  detailsTooManyVideos: (n: number) => `Up to ${n} videos.`,
  detailsInstagramHint: 'Your Instagram handle, like @ritmoleeds, or a link to the page.',
  detailsChat: 'Group chat link',
  detailsChatHint: 'Dancers see a \u201cJoin the group\u201d button. Leave it empty for none.',
  detailsChatBad: 'Enter the whole group chat link, like https://chat.whatsapp.com/ and the code after it, or leave it empty.',
  detailsKind: 'What it is',
  detailsKindHint: 'Worked out from your sessions. Change a session to change it.',
  detailsKindHintFestival: 'Festival sessions are set with the Bachata Calendar team. Ask us to change the programme.',
  detailsVideosNote: 'Dancers see the first link that can play (YouTube, Vimeo or an uploaded video). The others are kept.',
  detailsMore: 'More details',
  prices: 'Prices',
  pricesRowSub: 'What dancers pay and how',
  pricesIntro: 'What dancers pay. Shown next to the ticket link.',
  pricesFree: 'It\u2019s free',
  pricesFreeSub: 'Dancers see \u201cFree\u201d',
  /** The empty-list line: it names the free switch only when the switch is on screen (F-18). */
  pricesNone: (freeSwitchShown: boolean) => (freeSwitchShown
    ? 'No prices yet. Add one, or switch on \u201cIt\u2019s free\u201d.'
    : 'No prices yet. Use \u201cAdd a price\u201d below to add one.'),
  pricesAdd: 'Add a price',
  pricesRemove: 'Remove this price',
  pricesName: 'Name',
  pricesAmount: 'Price',
  pricesCurrency: 'Currency',
  pricesNamePlaceholder: 'e.g. Class and party',
  pricesLockedCount: (n: number) => `${n} ${n === 1 ? 'price is' : 'prices are'} on the event.`,
  payHow: 'How to pay',
  payHelp: 'Pick every way dancers can pay. Tap again to take one off.',
  payFestival: 'A festival sells through its ticket link.',
  changes: (n: number) => `${n} ${n === 1 ? 'change' : 'changes'}`,
  tapToSee: '(tap to see)',
  pendingTitle: (n: number) => `${n} ${n === 1 ? 'change' : 'changes'} not saved yet`,
  undoMineTitle: 'Undo your changes?',
  undoMineBody: 'This puts every field back to what is saved. Nothing is sent.',
  keepEditing: 'Keep editing',
  leaveTitle: 'Leave without saving?',
  leaveBody: 'These changes are not saved yet:',
  leaveGo: 'Leave and lose them',
  changedElsewhere: 'Someone else saved this event while you were editing. Your changes are still here, but saving them will be refused. To go on, copy anything you typed, then Start again from the saved version.',
  startAgain: 'Start again from the saved version',
  saving: 'Saving\u2026',
  historyRowSub: 'Every change, who made it and when',
  organisers: 'Organisers',
  organisersRowSub: 'The pages that run this event',
  historyIntro: 'Every change, who made it and when.',
  historyWho: { you: 'You', 'co-host': 'A co-host', team: 'The Bachata team', someone: 'Someone' },
  historyFor: (day: string) => `for ${day}`,
  historyChanged: (fields: readonly string[]) => `Changed: ${fields.join(', ')}`,
  historyEmptyTitle: 'Nothing has changed yet',
  historyEmptyBody: 'When you edit this event, it shows here.',
  historyBack: 'Back to the event',
  historyLoading: 'Loading the history\u2026',
  historyError: 'We couldn\u2019t load the history',
  historyErrorBody: 'Check your connection, then try again.',
  historyMore: 'Show older changes',
  historyMoreLoading: 'Loading older changes\u2026',
  historyMoreError: 'We couldn\u2019t load older changes. Try again.',
  // W3b-2: a date's own name, photos and price (C3 `dayown`).
  dateName: 'Name',
  datePhotos: 'Photos',
  datePrice: 'Price',
  dateNameBlank: 'Give this date a name',
  dateNameLong: (n: number) => `Keep the name to ${n} characters`,
  dateNameHint: 'Dancers see this name on this date only: the event page and the calendar.',
  datePhotosNone: 'No photos',
  datePhotosHint: 'Photos for this date only, on its event page. JPG, PNG or WebP.',
  datePhotosAdd: 'Add photos',
  datePhotosRemove: 'Remove this photo',
  datePhotosEmpty: 'No photos on this date yet. Add some to show them on its event page.',
  datePhotosMax: (n: number) => `${n} photos is the most a date can have. Remove one to add another.`,
  datePricesNone: 'No prices',
  datePricesHint: 'Prices for this date only, on its event page.',
  datePricesEmpty: 'No prices on this date yet. Add one to show it on its event page.',
  dateFieldsFestival: 'A festival\u2019s name, photos and prices are set for the whole festival. Ask the Bachata Calendar team.',
  dateFieldsCancelled: 'This date is cancelled. Bring it back first to put its name, photos or price back to usual.',
  dateLeaveAsk: 'Leave without saving? Your changes to this date will be lost.',
  dateLeaveGo: 'Leave without saving',
  dateLeaveStay: 'Keep editing',
  dateUndo: 'Undo my changes',
  dateUndoAsk: 'Undo your changes to this date?',
  dateUndoGo: 'Yes, undo them',
  dateNothing: 'Nothing changed yet',
  differentOn: (n: number) => (n === 1 ? 'Different on 1 date' : `Different on ${n} dates`),
  differentOnShown: (n: number) => `Different on ${n} of the dates shown`,
} as const;

export function sessionKindLabel(k: SessionKind): string {
  return [...L.sessKind, ...L.sessKindOther].find((x) => x[0] === k)?.[1] ?? k;
}

export function roleLabel(r: RoleKey): string {
  return L.roles.find((x) => x[0] === r)?.[1] ?? r;
}

// ---- moving a date that has people on it (Q10) ---------------------------------------

/** The server's refusal for a move of a date with people (admin move guard): message prefix. */
export const DATE_HAS_PEOPLE = /^date_has_people:/;

export interface PeopleCounts { guest_list: number; going: number; tickets: number; total: number }

const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/**
 * The counts of a `date_has_people:` refusal. `details` is JSON `{guest_list, going, tickets, total}`;
 * a missing or bad `details` falls back to the numbers in the message, and to null (no numbers) if none parse.
 */
export function peopleCountsOf(error: unknown): PeopleCounts | null {
  const e = (error && typeof error === 'object' ? error : {}) as { message?: unknown; details?: unknown };
  let raw: unknown = e.details;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = null; } }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const [g, n, t] = [whole(o.guest_list), whole(o.going), whole(o.tickets)];
    if (g !== null && n !== null && t !== null) return { guest_list: g, going: n, tickets: t, total: whole(o.total) ?? g + n + t };
  }
  const msg = typeof e.message === 'string' ? e.message.replace(DATE_HAS_PEOPLE, '') : '';
  // The real guard says `3 guest-list, 4 going, 2 tickets on <day>`: the number comes FIRST. `guest_list`,
  // `guest-list` and `guest list` all name the same count; a `key: n` form is read too.
  const keyed = (k: string) => msg.match(new RegExp(`${k}\\s*[:=]\\s*(\\d+)`)) ?? msg.match(new RegExp(`(\\d+)\\s*${k}\\b`));
  const [kg, kn, kt] = [keyed('guest[ _-]list'), keyed('going'), keyed('tickets')];
  const nums = kg && kn && kt ? [kg[1], kn[1], kt[1]] : (msg.match(/\d+/g) ?? []);
  if (nums.length < 3) return null;
  const [g, n, t] = nums.slice(0, 3).map(Number);
  return { guest_list: g, going: n, tickets: t, total: g + n + t };
}

/** What the notices on a move reply said, or null when the server sent none (today). */
export interface MoveNotices { queued: number; guest_list_unreached: number }
export function moveNoticesOf(reply: unknown): MoveNotices | null {
  const r = reply as { notices?: unknown; data?: { notices?: unknown } } | null | undefined;
  const raw = r?.notices ?? r?.data?.notices;
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const queued = whole(o.queued);
  return queued === null ? null : { queued, guest_list_unreached: whole(o.guest_list_unreached) ?? 0 };
}

/**
 * The line after a move, from the reply's notices (admin #1223: one email per paid ticket order and per "going"
 * user; guest-list entries hold no contact). No notices (server not applied yet) or nobody reached: only the
 * moved line, never a claim either way. The line BEFORE the move is `MOVE_PEOPLE_COPY.tell`.
 */
export function moveOutcomeCopy(notices: MoveNotices | null | undefined, moved: string): { done: string } {
  if (!notices) return { done: moved };
  const emailed = notices.queued > 0 ? ` We emailed ${notices.queued === 1 ? '1 person' : `${notices.queued} people`} about the new day.` : '';
  const unreached = notices.guest_list_unreached > 0
    ? ` ${notices.guest_list_unreached} on the guest list could not be emailed, so you may want to tell them yourself.`
    : '';
  return { done: `${moved}${emailed}${unreached}` };
}

export const MOVE_PEOPLE_COPY = {
  title: (total: number | null) => (total === null ? 'People are on this date' : total === 1 ? '1 person is on this date' : `${total} people are on this date`),
  /** Only the non-zero parts, in the order guest list, going, tickets. */
  body: (c: PeopleCounts | null): string => {
    if (!c) return '';
    const parts = [
      c.guest_list > 0 ? `${c.guest_list} on the guest list` : '',
      c.going > 0 ? `${c.going} going` : '',
      c.tickets > 0 ? `${c.tickets} with tickets` : '',
    ].filter(Boolean);
    return parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  },
  /**
   * Who hears about the move, said before it (true once admin #1223 is applied): ticket buyers and people going
   * are emailed; guest-list entries cannot be. Only the kinds that are on the date; null counts say both.
   */
  tell: (c: PeopleCounts | null): string => {
    const mailed = !c ? 'Ticket buyers and people who said they are going'
      : c.tickets > 0 && c.going > 0 ? 'Ticket buyers and people who said they are going'
        : c.tickets > 0 ? 'Ticket buyers' : c.going > 0 ? 'People who said they are going' : '';
    const first = mailed ? `${mailed} get an email about the new day.` : '';
    const guests = !c ? 'People on the guest list cannot be emailed, so you may want to tell them yourself.'
      : c.guest_list > 0 ? `${c.guest_list} on the guest list cannot be emailed. You may want to tell them yourself.` : '';
    return [first, guests].filter(Boolean).join(' ');
  },
  anyway: 'Move it anyway',
  another: 'Choose another day',
};
