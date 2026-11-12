// People arc P2 mockups -- the ONE shared fact mapping every direction reads.
// Data: prod read-only SELECT, 2026-10-23 (see data.md). Public display names only.
// Every fact a direction shows comes from a function here, never a local copy.

/* eslint-disable no-unused-vars */
const WALL = { page: '#1E1410', card: '#2B1D16', text: '#FBEBDD', muted: '#CDB09C', line: '#6A4A38' };
const CHIP = {
  dj: { bg: '#F2B632', text: '#2B1A00', border: '#FFD479' },
  dancer: { bg: '#2DD4BF', text: '#04302C', border: '#8DF0E2' },
  teacher: { bg: '#B79CFB', text: '#1E0A4D', border: '#D8C8FD' },
};
const TILE = {
  dj: { bg: '#6B4A0E', ink: '#FFE3A0', edge: '#C9921E' },
  dancer: { bg: '#0F4F4A', ink: '#A7F3E8', edge: '#2DD4BF' },
  teacher: { bg: '#4A2D8A', ink: '#E4D7FB', edge: '#A78BFA' },
};
const GOLD = '#FFD479';

const ROLE_ORDER = ['teacher', 'dj', 'dancer'];
const ROLE_LABEL = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };
const ROLE_PATH = { teacher: 'teachers', dj: 'djs', dancer: 'dancers' };
const LANG = { es: 'Spanish', en: 'English', fr: 'French', it: 'Italian', pt: 'Portuguese' };
const COUNTRY = { BO: 'Bolivia', ZA: 'South Africa' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

// Upcoming rows come from get_profile_event_timeline_v2(role, id) (lineup authority: program people).
// `photo` is true when dancer_profiles.avatar_url is set; image hosts are unreachable from the
// sandbox, so a photo is drawn as a marked stand-in, never a fake face.
const PEOPLE = {
  magda: {
    id: '440f99dd', name: 'Magda', slug: 'unclaimed-440f99dd', photo: false, city: 'London',
    roles: ['dancer'], danceRole: 'Lead and Follow', languages: [], nationality: null, dates: {},
  },
  pierre: {
    id: '0dd8819b', name: 'Pierre Henry', slug: 'pierre-henry', photo: false, city: null,
    roles: ['teacher'], danceRole: null, languages: [], nationality: null, dates: {},
  },
  papacito: {
    id: 'ae3bffbb', name: 'Papacito', slug: 'papacito', photo: true, city: 'London',
    roles: ['dj', 'dancer'], danceRole: 'Leader', languages: [], nationality: 'ZA',
    dates: {
      dj: [
        { at: '2026-10-23T22:00', event: 'Ronald &amp; Alba - Halloween Edition - Sensual Vibes', venue: 'BPM Dance Studios' },
        { at: '2026-12-31T21:30', event: 'NYE - Masquerade Ball - Sensual Vibes', venue: 'BPM Dance Studios' },
      ],
    },
  },
  ramiro: {
    id: '456af8d2', name: 'Ramiro Zapata', slug: 'ramiro-zapata', photo: true, city: 'London',
    roles: ['teacher', 'dj', 'dancer'], danceRole: 'Leader', languages: ['es', 'en'], nationality: 'BO',
    dates: {
      dj: [
        { at: '2026-10-29T19:30', event: 'Wild Bachata', venue: 'Dance Station' },
        { at: '2026-10-31T19:30', event: 'Bachata on Saturday', venue: 'Dance Station' },
        { at: '2026-11-07T19:30', event: 'Party Pa ti', venue: 'Guy&rsquo;s Bar' },
      ],
      teacher: [{ at: '2026-11-21T19:00', event: '50/50', venue: 'Guy&rsquo;s Bar' }],
    },
  },
  sabrina: {
    id: '6f05d2f6', name: 'Sabrina Guzman Pastor', slug: 'unclaimed-6f05d2f6', photo: true, city: 'London',
    roles: ['dancer'], danceRole: 'Follower', languages: [], nationality: null, dates: {},
  },
};

// The five shapes the brief names, each opened from one role link.
const SHAPES = [
  { key: 'thin-dancer', person: 'magda', tabs: ['dancer'], label: 'Thin dancer-only, no photo' },
  { key: 'thin-teacher', person: 'pierre', tabs: ['teacher'], label: 'Teacher-only, no photo, no city (the most common person)' },
  { key: 'dj-2gigs', person: 'papacito', tabs: ['dj'], label: 'DJ with 2 upcoming gigs (no DJ-only person has 2+ on prod; this one is DJ + dancer)' },
  { key: 'rich', person: 'ramiro', tabs: ['teacher', 'dj', 'dancer'], label: 'All three roles, rich (each tab)' },
  { key: 'long-name', person: 'sabrina', tabs: ['dancer'], label: 'Long name (21 characters), dancer-only, photo' },
];

// ---- the facts ----
const tabsOf = (p) => ROLE_ORDER.filter((r) => p.roles.includes(r));
const hasTabRow = (p) => tabsOf(p).length > 1;
const urlOf = (p, role) => `/${ROLE_PATH[role]}/${p.slug}`;
const initialsOf = (p) => p.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const cityOf = (p) => p.city || null;
const languagesOf = (p) => (p.languages || []).map((c) => LANG[c] || null).filter(Boolean);
const countryOf = (p) => (p.nationality ? COUNTRY[p.nationality] || null : null);
const upcomingOf = (p, role) => (p.dates[role] || []).slice().sort((a, b) => a.at.localeCompare(b.at));
const parseAt = (at) => { const [d, t] = at.split('T'); const [y, m, dd] = d.split('-').map(Number); return { date: new Date(Date.UTC(y, m - 1, dd)), time: t }; };
/** "Friday 23 October" -- full weekday + month, the one date label. */
const dateLabel = (at) => { const { date } = parseAt(at); return `${DAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`; };
const timeLabel = (at) => parseAt(at).time;
/** Count only from 2 (owner rule). */
const countLabel = (n) => (n >= 2 ? `${n} coming up` : null);
const datesHeading = { dj: 'Next gigs', teacher: 'Teaching next' };
/** Kicker under the name: "Teacher &middot; London", or just "Teacher" with no city. */
const kickerOf = (p, role) => [ROLE_LABEL[role], cityOf(p)].filter(Boolean).join(' &middot; ');
/** Dancer-tab facts: only the filled ones, in this order. */
const dancerFacts = (p) => [
  p.danceRole && { k: 'Dances', v: p.danceRole },
  languagesOf(p).length && { k: 'Speaks', v: languagesOf(p).join(', ') },
  countryOf(p) && { k: 'From', v: countryOf(p) },
].filter(Boolean);
/** The one action every page has, and the role-aware calendar action for a page with no dates. */
const calendarAction = (p, role) => {
  const where = cityOf(p) ? ` in ${cityOf(p)}` : '';
  if (role === 'dj') return { label: `Parties${where} this week`, href: '/calendar?type=party' };
  if (role === 'teacher') return { label: `Classes${where} this week`, href: '/calendar?type=class' };
  return { label: `Socials${where} this week`, href: '/calendar?type=party' };
};
/** Link preview: og:title follows the role link (D1). */
const ogTitle = (p, role) => `${p.name} &middot; ${ROLE_LABEL[role]}${cityOf(p) ? ` in ${cityOf(p)}` : ''}`;
const ogDescription = (p, role) => {
  const up = upcomingOf(p, role);
  if (role === 'dj' && up.length) return [`Next gig ${dateLabel(up[0].at)}`, countLabel(up.length)].filter(Boolean).join(' &middot; ');
  if (role === 'teacher' && up.length) return `Teaching ${dateLabel(up[0].at)} at ${up[0].venue}`;
  if (role === 'dancer') { const f = dancerFacts(p); if (f.length) return f.map((x) => x.v).join(' &middot; '); }
  return `On Bachata Calendar${cityOf(p) ? `, ${cityOf(p)}` : ''}`;
};

/** Ground tinted by the active tab (D4): the warm base mixed with the role edge. Solid, so contrast is measurable. */
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const groundOf = (role) => mix(WALL.page, TILE[role].edge, 0.10);
const cardOf = (role) => mix(WALL.card, TILE[role].edge, 0.14);

/** Where every fact comes from (rendered in the gallery). */
const FACT_SOURCES = [
  ['Name', 'p.name: the public display name (masked-names rule), ONE name on every tab', 'dancer_profiles display_name / first_name (+ surname unless hidden)'],
  ['Photo or initials', 'initialsOf; photo stand-in when avatar_url is set', 'dancer_profiles.avatar_url'],
  ['Roles / tabs', 'tabsOf, order Teacher, DJ, Dancer; tab row only from 2 roles', 'get_public_person_roles_v1(id)'],
  ['City', 'cityOf (hidden when empty)', 'dancer_profiles.based_city_id &rarr; cities.name'],
  ['Kicker', 'kickerOf: "Role &middot; City"', 'roles + city'],
  ['Next gigs / Teaching next', 'upcomingOf + dateLabel ("Friday 23 October") + timeLabel', 'get_profile_event_timeline_v2(role, id), rows from now'],
  ['Gig count', 'countLabel, only from 2', 'same rows'],
  ['Dances / Speaks / From', 'dancerFacts: only filled facts; languages as full names', 'dance_role, languages, nationality'],
  ['Calendar action', 'calendarAction (role + city aware)', 'roles + city; links to the calendar'],
  ['Link preview title', 'ogTitle "Name &middot; Role in City"', 'role link + facts above'],
  ['Link preview text', 'ogDescription', 'facts above'],
  ['Ground tint', 'groundOf(active tab)', 'wall tokens WALL.page + TILE[role].edge'],
];
