import { levelWord, typeWord, type PItem } from '../../events/programmeSeriesModel';

/** Editor v2 (S1): every owner-facing line, in one place. Punctuation as \u escapes (cp1252 mojibake rule). */
export const V2 = {
  // event page header and rows (prototype)
  events: 'Events',
  add: 'Add',
  added: 'Added',
  loading: 'Loading\u2026',
  done: 'Done',
  to: (end: string) => `to ${end}`,
  photos: (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`,
  videoCount: (n: number) => `${n} ${n === 1 ? 'video' : 'videos'}`,
  noSessions: 'No sessions yet. Add a class or a party so dancers see what is on.',
  eventCard: 'The event',
  name: 'Name',
  about: 'About',
  music: 'Music',
  venue: 'Venue',
  repeat: 'Repeat',
  changeRepeat: 'Change repeat',
  date: 'Date',
  changeDate: 'Change date',
  whoRuns: 'Who runs it',
  programme: 'Programme',
  addSession: 'Add a session',
  programmeLine: 'Teachers and DJs are set inside each session.',
  tickets: 'Tickets',
  pictures: 'Pictures and videos',
  flyer: 'Flyer',
  gallery: 'Gallery',
  videos: 'Videos',
  upcoming: 'Upcoming dates',
  upcomingLine: 'Tap a date to change just that night.',
  showMore: 'Show more dates',
  noUpcoming: 'No upcoming dates. Change repeat to add some.',
  guestList: 'Guest list',
  pauseOrEnd: 'Pause or end event',
  cancelEvent: 'Cancel the event',
  bringBackEvent: 'Event cancelled: bring it back',
  tagCancelled: 'Cancelled',
  tagEnded: 'Ended',
  tagChanged: 'Changed',
  // night
  cancelNight: 'Cancel this night',
  keepNight: 'Keep this night',
  nightOnly: (day: string) => `Changes here are for ${day} only.`,
  nightCancelled: 'This night is cancelled.',
  bringNightBack: 'Bring this night back',
  shareNight: 'Share this night',
  copyLink: 'Copy link',
  share: 'Share',
  copied: 'Link copied',
  copyFrom: 'Copy changes from another date',
  nightName: 'Name for this night',
  nightAbout: 'About this night',
  nightPicture: 'Picture',
  usual: 'Usual',
  changed: 'Changed for this night',
  backToUsual: 'Back to usual',
  nightTickets: 'Tickets for this night',
  nightGuestList: 'Guest list for this night',
  nightSessions: 'Sessions that night',
  addNightSession: 'Add a session for this night only',
  noNightSessions: 'No sessions that night. Add one for this night only below.',
  sessionCancel: 'Cancel for this night',
  sessionRemove: 'Remove',
  sessionBringBack: 'Bring back',
  sessionOff: 'Not on this night.',
  nightReadFail: 'Could not load this night\u2019s own values.',
  uploading: 'Uploading\u2026',
  // save bar
  undo: 'Undo',
  save: 'Save',
  saving: 'Saving\u2026',
  notSaved: (part: string) => `Not saved: ${part}. Try again.`,
  undone: (summary: string) => `Undone: ${summary}`,
  saved: 'Saved',
  // unsaved sheet
  unsavedTitle: 'You have unsaved changes',
  throwAway: 'Throw away changes',
  keepEditing: 'Keep editing',
  throwAwayTyped: 'Throw away what you typed?',
  // cancel / status
  cancelBody: 'Dancers see Cancelled and your reason.',
  cancelNow: 'This takes effect straight away.',
  saveFirst: 'Save or undo your changes first.',
  pauseLine: 'Dates stop showing until you make it live again.',
  endLine: 'No new dates after today. Upcoming dates show Ended.',
  sure: 'Are you sure?',
  s2Slot: 'Ticket settings move here in the next update.',
  noResults: 'No results',
  // rule lines (model)
  endsNextDay: 'Ends the next day',
  lastDatePast: 'The last date must be today or later.',
  lastDateWeekday: (weekday: string) => `The last date must be a ${weekday}.`,
  keepOneOrganiser: 'An event needs at least one organiser.',
  removeSelf: 'Remove yourself? You will lose access to this event.',
  sessionOverrides: (n: number) => `${n} ${n === 1 ? 'date has its' : 'dates have their'} own changes to this session. They will be removed.`,
  nightSessionsOff: {
    multiDay: 'Sessions for one night cannot be set on an event that runs over several days.',
    cancelled: 'This night is cancelled, so its sessions cannot change.',
    past: 'This night has passed, so its sessions cannot change.',
  },
} as const;

/** The programme row's second line, "Class \u00b7 Ana, Ben \u00b7 Beginner": type, people, levels (prototype). */
export function sessionLine(s: Pick<PItem, 'type' | 'people' | 'levels'>): string {
  const people = s.people.map((p) => p.name.trim()).filter(Boolean).join(', ');
  const levels = s.levels.map(levelWord).join(', ');
  return [typeWord(s.type), people, levels].filter(Boolean).join(' \u00b7 ');
}

/** The Repeat row on one line each: "Every Friday" over "Last date Friday 25 December" (no wrapped sentence). */
export function repeatParts(words: string): { head: string; rest: string; full: string } {
  const full = words.trim().replace(/\.$/, '');
  const at = full.indexOf(', ');
  if (at < 0) return { head: full, rest: '', full };
  const rest = full.slice(at + 2);
  return { head: full.slice(0, at), rest: rest.charAt(0).toUpperCase() + rest.slice(1), full };
}
