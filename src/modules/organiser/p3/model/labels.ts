import type { P3Kind, RoleKey, SessionKind } from './types';

/**
 * The single label list `L` (C3.md "Shared labels", C2's kept). Every P3
 * screen reads its words from here; never type one of these in a component.
 * Plain text: punctuation is written as \u escapes, never pasted Unicode
 * (CLAUDE.md, HTML entities over raw Unicode).
 */
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
  skip: 'Skip this week (break)',
  skipped: 'Break',
  unskip: 'Put this week back',
  cancelWhy: 'Why? (dancers see this)',

  // status
  live: 'Live',
  hidden: 'Hidden',
  finished: 'Finished',
  draft: 'Draft (only you see it)',
  endIt: 'This has finished (end it)',
  backDraft: 'Take it off the calendar (back to draft)',
  stopRepeat: 'Stop repeating, I will add dates myself',
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
  resetDate: 'Put this date back to normal',

  // other
  makeCopy: 'Make a copy',
  history: 'History',
  share: 'Share',
  whosGoing: 'Who\u2019s going',
  moreOpts: 'More options',
  askCity: 'Ask us to change the city',
  checkedSoon: 'We check new venues within a day.',

  /** The shape names (create flow, Repeats row). Not the kind word: that is eventCategory's. */
  kind: {
    weekly: 'Weekly social',
    monthly: 'Monthly social',
    course: 'Course',
    oneoff: 'One-off party',
    custom: 'Dates I pick',
    festival: 'Festival',
  } as Record<P3Kind, string>,
} as const;

export function sessionKindLabel(k: SessionKind): string {
  return [...L.sessKind, ...L.sessKindOther].find((x) => x[0] === k)?.[1] ?? k;
}

export function roleLabel(r: RoleKey): string {
  return L.roles.find((x) => x[0] === r)?.[1] ?? r;
}
