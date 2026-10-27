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
    details: ['Different details this date', 'Where, about, ticket link, photo'],
    resetNormal: [RESET_DATE, 'Where, about, ticket link, photo and time go back to usual. Sessions stay as they are.'],
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
  /** Toasts after a programme write. */
  savedEvery: 'Saved for every date. Dancers see it now.',
  savedDate: (day: string) => `Saved for ${day} only. Dancers see it now.`,
  addedEvery: 'Session added to every date. Dancers see it now.',
  addedDate: (day: string) => `Added to ${day} only. Dancers see it now.`,
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
  detailsAboutHint: 'What should dancers know? For example: no partner needed, class first, then the party.',
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
  detailsCoverNone: 'No cover photo yet. Add one: dancers see it before anything else.',
  detailsUploading: 'Uploading the photo\u2026',
  detailsVideos: 'Videos',
  detailsVideosHint: 'One link per line, starting with https://',
  detailsTooManyVideos: (n: number) => `Up to ${n} videos.`,
  detailsInstagramHint: 'Your Instagram handle, like @ritmoleeds, or a link to the page.',
  detailsChat: 'Group chat link',
  detailsChatHint: 'Dancers see a \u201cJoin the group\u201d button. Leave it empty for none.',
  detailsChatBad: 'Enter a group chat link starting with https://, or leave it empty.',
  detailsKind: 'What it is',
  detailsKindHint: 'Worked out from your sessions. Change a session to change it.',
  detailsSaved: 'Saved for every date. Dancers see it now.',
  prices: 'Prices',
  pricesRowSub: 'What dancers pay and how',
  pricesIntro: 'What dancers pay. Shown next to the ticket link.',
  pricesFree: 'It\u2019s free',
  pricesFreeSub: 'Dancers see \u201cFree\u201d',
  pricesNone: 'No prices yet. Add one, or switch on \u201cIt\u2019s free\u201d.',
  pricesAdd: 'Add a price',
  pricesRemove: 'Remove this price',
  pricesName: 'Name',
  pricesAmount: 'Price',
  pricesCurrency: 'Currency',
  pricesNamePlaceholder: 'e.g. Class and party',
  pricesLockedCount: (n: number) => `${n} ${n === 1 ? 'price is' : 'prices are'} on the event.`,
  pricesSaved: 'Prices saved. Dancers see them now.',
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
  changedElsewhere: 'Someone else saved this event while you were editing. Your changes are still here: saving puts yours over theirs for the fields you changed.',
  startAgain: 'Start again from the saved version',
  saving: 'Saving\u2026',
} as const;

export function sessionKindLabel(k: SessionKind): string {
  return [...L.sessKind, ...L.sessKindOther].find((x) => x[0] === k)?.[1] ?? k;
}

export function roleLabel(r: RoleKey): string {
  return L.roles.find((x) => x[0] === r)?.[1] ?? r;
}
