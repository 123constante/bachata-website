// People arc P2b worlds -- the ONE shared fact mapping every world reads.
// Data: prod read-only SELECT, 2026-10-23 (see ../data.md). Public display names only.
// Every fact a world shows comes from a function here, never a local copy.
/* eslint-disable no-unused-vars */

const ROLE_ORDER = ['teacher', 'dj', 'dancer'];
const ROLE_LABEL = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };
const ROLE_PATH = { teacher: 'teachers', dj: 'djs', dancer: 'dancers' };
const LANG = { es: 'Spanish', en: 'English', fr: 'French', it: 'Italian', pt: 'Portuguese' };
const COUNTRY = { BO: 'Bolivia', ZA: 'South Africa' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const TODAY = '2026-10-23';

// Times are London wall-clock (BST until Sunday 25 October, GMT after), converted from the UTC rows.
// `photo` is true when a photo is set; the image host is unreachable from the sandbox, so a photo is
// drawn as a marked stand-in, never a fake face.
const PEOPLE = {
  magda: {
    id: '440f99dd', name: 'Magda', slug: 'unclaimed-440f99dd', photo: false, city: 'London',
    roles: ['dancer'], danceRole: 'Lead and Follow', languages: [], nationality: null, dates: {}, played: {},
  },
  sabrina: {
    id: '6f05d2f6', name: 'Sabrina Guzman Pastor', slug: 'unclaimed-6f05d2f6', photo: true, city: 'London',
    roles: ['dancer'], danceRole: 'Follower', languages: [], nationality: null, dates: {}, played: {},
  },
  pierre: {
    id: '0dd8819b', name: 'Pierre Henry', slug: 'pierre-henry', photo: false, city: null,
    roles: ['teacher'], danceRole: null, languages: [], nationality: null, dates: {}, played: {},
  },
  nadeem: {
    id: '997b9d08', name: 'Nadeem Malik', slug: 'nadeem-malik', photo: false, city: null,
    roles: ['teacher'], danceRole: null, languages: [], nationality: null, played: {},
    dates: { teacher: [{ at: '2026-10-29T19:30', event: 'Latin Krazy', venue: 'Sway Bar' }] },
  },
  papacito: {
    id: 'ae3bffbb', name: 'Papacito', djName: 'Morcilla', slug: 'papacito', photo: true, city: 'London',
    roles: ['dj', 'dancer'], danceRole: 'Leader', languages: [], nationality: 'ZA',
    website: 'instagram.com/dj_morcilla',
    dates: {
      dj: [
        { at: '2026-10-23T22:00', event: 'Ronald &amp; Alba - Halloween Edition - Sensual Vibes', venue: 'BPM Dance Studios' },
        { at: '2026-12-31T21:30', event: 'NYE - Masquerade Ball - Sensual Vibes', venue: 'BPM Dance Studios' },
      ],
    },
    played: { dj: [{ at: '2026-10-09', event: 'Sensual Vibes' }, { at: '2026-09-25', event: 'Raquel Castro (Ladies Styling Special) - Pyjama Party' }] },
  },
  ramiro: {
    id: '456af8d2', name: 'Ramiro Zapata', djName: null, slug: 'ramiro-zapata', photo: true, city: 'London',
    roles: ['teacher', 'dj', 'dancer'], danceRole: 'Leader', languages: ['es', 'en'], nationality: 'BO',
    website: 'tropicanadanceschool.co.uk',
    dates: {
      dj: [
        { at: '2026-10-29T19:30', event: 'Wild Bachata', venue: 'Dance Station' },
        { at: '2026-10-31T19:30', event: 'Bachata on Saturday', venue: 'Dance Station' },
        { at: '2026-11-07T19:30', event: 'Party Pa ti', venue: 'Guy&rsquo;s Bar' },
      ],
      teacher: [{ at: '2026-11-21T19:00', event: '50/50', venue: 'Guy&rsquo;s Bar' }],
    },
    played: { dj: [{ at: '2026-10-17', event: '50/50' }, { at: '2026-08-29', event: 'London Loves BOS' }] },
  },
};

// get_calendar_events_v2('2026-10-23','2026-10-29','london-gb'): the first parties of the week,
// not cancelled, festivals abroad left out. Used by dancer lower-half option 1.
const SOCIALS = {
  London: [
    { at: '2026-10-23T20:00', event: 'Unidos Flow', venue: 'G Happy Feet Studios' },
    { at: '2026-10-23T21:00', event: 'Pura Wild Nights', venue: 'Dance Station' },
    { at: '2026-10-24T15:30', event: 'Daytime Bachata Social', venue: 'Southbank Club' },
    { at: '2026-10-24T20:00', event: 'Bachateame', venue: 'Ritmo Latino Studio' },
    { at: '2026-10-24T20:30', event: 'Bachata On Saturday: Fusion Edition', venue: 'The Vault' },
  ],
};

// What each page shows: person x world. `filler` is the dancer lower half (1, 2 or 3).
const PAGES = [
  { key: 'magda-dancer', person: 'magda', role: 'dancer', label: 'Magda, thin dancer-only, no photo' },
  { key: 'sabrina-dancer', person: 'sabrina', role: 'dancer', label: 'Sabrina Guzman Pastor, long name (21 characters)' },
  { key: 'pierre-teacher', person: 'pierre', role: 'teacher', label: 'Pierre Henry, teacher-only, no photo, no city, no class' },
  { key: 'nadeem-teacher', person: 'nadeem', role: 'teacher', label: 'Nadeem Malik, teacher-only with a class next Thursday' },
  { key: 'papacito-dj', person: 'papacito', role: 'dj', label: 'Papacito, DJ world (DJ name Morcilla, 2 gigs)' },
  { key: 'papacito-dancer', person: 'papacito', role: 'dancer', label: 'Papacito, dancer world' },
  { key: 'ramiro-teacher', person: 'ramiro', role: 'teacher', label: 'Ramiro Zapata, teacher world' },
  { key: 'ramiro-dj', person: 'ramiro', role: 'dj', label: 'Ramiro Zapata, DJ world (no DJ name set)' },
  { key: 'ramiro-dancer', person: 'ramiro', role: 'dancer', label: 'Ramiro Zapata, dancer world' },
];
const FILLERS = {
  1: 'Socials to dance at this week, from the calendar in their city',
  2: 'A preview of their other worlds (next class, next DJ set)',
  3: 'Short page: the footer comes up',
};

// ---- the facts ----
const tabsOf = (p) => ROLE_ORDER.filter((r) => p.roles.includes(r));
const hasTabRow = (p) => tabsOf(p).length > 1;
const urlOf = (p, role) => `/${ROLE_PATH[role]}/${p.slug}`;
const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
/** The one name rule: DJ world = DJ name big + public name small; other worlds = public name. */
const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/^DJ\s+/i, '').trim();
const namesOf = (p, role) => {
  if (role === 'dj' && clean(p.djName) && clean(p.djName) !== clean(p.name)) return { big: clean(p.djName), small: clean(p.name) };
  return { big: clean(p.name), small: null };
};
const cityOf = (p) => p.city || null;
const languagesOf = (p) => (p.languages || []).map((c) => LANG[c] || null).filter(Boolean);
const languageLine = (p) => languagesOf(p).join(', ');
const countryOf = (p) => (p.nationality ? COUNTRY[p.nationality] || null : null);
/** Flag from the ISO code, as HTML entities (regional indicators); never the raw code. */
const flagOf = (p) => (p.nationality ? [...p.nationality].map((c) => `&#x${(0x1f1e6 + c.charCodeAt(0) - 65).toString(16)};`).join('') : '');
const upcomingOf = (p, role) => ((p.dates || {})[role] || []).filter((d) => d.at.slice(0, 10) >= TODAY).sort((a, b) => a.at.localeCompare(b.at));
const playedOf = (p, role) => ((p.played || {})[role] || []);
const parseAt = (at) => { const [d, t] = at.split('T'); const [y, m, dd] = d.split('-').map(Number); return { date: new Date(Date.UTC(y, m - 1, dd)), time: t || null }; };
/** "Friday 23 October" -- full weekday + month, the one date label. */
const dateLabel = (at) => { const { date } = parseAt(at); return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`; };
const monthLabel = (at) => { const { date } = parseAt(at); return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`; };
const timeLabel = (at) => parseAt(at).time;
const dayNum = (at) => parseAt(at).date.getUTCDate();
/** Count only from 2 (owner rule). */
const countLabel = (n, noun) => (n >= 2 ? `${n} ${noun}` : null);
/** "Leader &middot; London": only the filled facts. */
const subLine = (p) => [p.danceRole, cityOf(p)].filter(Boolean).join(' &middot; ');
/** The other worlds a dancer page can preview (lower-half option 2). */
const otherWorlds = (p, role) => tabsOf(p).filter((r) => r !== role && r !== 'dancer').map((r) => {
  const next = upcomingOf(p, r)[0];
  return { role: r, href: urlOf(p, r), next, line: next ? `${r === 'dj' ? 'Next DJ set' : 'Next class'} ${dateLabel(next.at)}` : null };
});
const socialsFor = (p) => (cityOf(p) ? SOCIALS[cityOf(p)] || [] : []);
/** Which lower half a dancer page gets when the owner has not chosen: 2 if any other world has a date, else 1, else 3. */
const defaultFiller = (p, role) => (otherWorlds(p, role).some((w) => w.next) ? 2 : socialsFor(p).length ? 1 : 3);

const FACT_SOURCES = [
  ['Name', 'namesOf: DJ world = DJ name big + public name small (only when different); else the public name', 'dancer_profiles display name; get_public_dj_v1.dj_name'],
  ['Photo or initials', 'initialsOf; photo stand-in when a photo is set', 'dancer_profiles.avatar_url'],
  ['Role tabs', 'tabsOf, order Teacher, DJ, Dancer; ALL roles, current one selected; only from 2 roles', 'get_public_person_roles_v1(id)'],
  ['City', 'cityOf (hidden when empty, never a postcode)', 'based_city_id &rarr; cities.name'],
  ['Flag', 'flagOf: the ISO code drawn as a flag, country name for screen readers', 'nationality'],
  ['Languages', 'languageLine: "Spanish, English"', 'languages'],
  ['Dates', 'upcomingOf + dateLabel ("Friday 23 October") + timeLabel', 'get_profile_event_timeline_v2(role, id), rows from today'],
  ['Counts', 'countLabel, only from 2', 'same rows'],
  ['Played at', 'playedOf, month + year', 'same RPC, rows before today'],
  ['Socials this week', 'socialsFor(city)', 'get_calendar_events_v2(week, city)'],
];
