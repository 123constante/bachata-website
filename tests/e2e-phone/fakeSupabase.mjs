// A fake of the Supabase HTTP API (PostgREST /rest/v1, GoTrue /auth/v1, Storage)
// for the PHONE suite (playwright.phone.config.ts). ONE answer() serves both sides
// of the page:
//   - the dev server's SSR loaders, through fakeSupabasePreload.mjs, which patches
//     Node's global fetch inside the dev-server process (page.route() can never
//     reach a server loader -- see playwright.config.ts webServer note);
//   - the browser, through page.route() in helpers.ts.
// So framework routes (/organisers/:id, /faq, /city/:slug ...) render for real,
// with no secret and no request leaving the machine. Table writes and write-shaped
// RPCs (WRITE_RPC_RE) are refused.
//
// Plain .mjs with no imports: the preload is loaded by Node via --import before
// the dev server, without any TypeScript loader.

// NOT the production ref: if a request ever slips past both interceptors it goes
// to a project that does not exist and fails, instead of reaching production.
// Still under *.supabase.co, because the CSP's connect-src only admits that.
export const FAKE_REF = 'phoneqafakenotaproject';
export const FAKE_ORIGIN = `https://${FAKE_REF}.supabase.co`;

export const ORG_ID = 'a0000000-0000-4000-8000-0000000000a1';
export const ORG_SLUG = 'ritmo-phone-qa';
export const CITY_ID = 'c1000000-0000-4000-8000-000000000001';
// A second organiser WITH upcoming nights (the first has none): the "Upcoming
// events" heading row and its owner-only Create event link need one.
export const ORG2_ID = 'a0000000-0000-4000-8000-0000000000a2';
export const ORG2_SLUG = 'salsa-nights-phone-qa';
// The City sheet's pick (resolveCanonicalCity confirms it against `cities`).
// Hero-polish organisers: a long name, a long category and a founded year, for
// organiser-hero-owner.phone.spec.ts. Looked up by slug only.
export const HERO_ORGS = [
  { id: 'a0000000-0000-4000-8000-0000000000a3', slug: 'bachata-playground-phone-qa', name: 'Bachata Playground' },
  { id: 'a0000000-0000-4000-8000-0000000000a4', slug: 'long-name-phone-qa', name: 'Bachata Playground Dance Company L' },
];
export const HERO_CATEGORY = 'Dance school and social events';

export const CITY2_ID = 'c1000000-0000-4000-8000-000000000002';

// search_cities, matched on the display name and cut to p_limit (the organiser
// search asks for 12): "united" matches every row, so the City sheet's list
// overflows and must scroll inside the sheet at 360x640.
const SEARCH_CITY_NAMES = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Leicester',
  'Coventry', 'Bradford', 'Cardiff', 'Belfast', 'Nottingham', 'Southampton', 'Brighton', 'Newcastle upon Tyne', 'Plymouth', 'Reading'];
const searchCityRows = (q, limit) => SEARCH_CITY_NAMES
  .map((name, i) => ({
    city_id: i === 0 ? CITY_ID : i === 1 ? CITY2_ID : `c1000000-0000-4000-8000-0000000000${String(i + 10).padStart(2, '0')}`,
    city_name: name,
    city_slug: `${name.toLowerCase().replace(/\W+/g, '-')}-gb`,
    country_name: 'United Kingdom',
    display_name: `${name}, United Kingdom`,
  }))
  .filter((r) => r.display_name.toLowerCase().includes(String(q ?? '').toLowerCase()))
  .slice(0, Number(limit) || 20);

// The team picker's search (organiser_team_search_people_v1, admin #773): matched
// on the name with accents folded, capped at p_limit (at most 8), nothing under two
// letters. Shapes from the prod survey: most have no photo; plus an accented name,
// a long name and a missing city, so the rows are checked against all of them.
// "an" matches more than three, so the list must scroll inside the sheet.
const PHOTO = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' fill='%23c8348f'/%3E%3C/svg%3E";
export const TEAM_PEOPLE = [
  { profile_id: 'd0000000-0000-4000-8000-0000000000d1', display_name: 'Ana Ruiz', photo_url: PHOTO, city_name: 'London' },
  { profile_id: 'd0000000-0000-4000-8000-0000000000d2', display_name: 'José Ñúñez', photo_url: null, city_name: 'Málaga' },
  { profile_id: 'd0000000-0000-4000-8000-0000000000d3', display_name: 'Marta Lopez', photo_url: null, city_name: null },
  { profile_id: 'd0000000-0000-4000-8000-0000000000d4', display_name: 'Maria Fernanda de los Ángeles Rodríguez-Villanueva', photo_url: null, city_name: 'Manchester' },
  { profile_id: 'd0000000-0000-4000-8000-0000000000d5', display_name: 'Daniel Santos', photo_url: null, city_name: 'Leeds' },
  { profile_id: 'd0000000-0000-4000-8000-0000000000d6', display_name: 'Joanna Kent', photo_url: null, city_name: 'Bristol' },
];
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const searchPeopleRows = (q, limit) => {
  const term = fold(q).trim();
  if (term.length < 2) return [];
  return TEAM_PEOPLE.filter((p) => fold(p.display_name).includes(term)).slice(0, Math.min(Number(limit) || 8, 8));
};

const LONG = 'Weekly bachata socials and classes in central London. '.repeat(6).trim();

// ---------------------------------------------------------------------------
// People with a nationality flag (people-nationality-flag.phone.spec.ts).
// Prod survey 2026-10-12 (read-only, counts only): of 166 dancer profiles 17 carry a
// code (about 1 in 10), 11 codes in use (ES CO x4, AR x2, EC BO ZA IT VE GB DE CY x1);
// the rest emit nationality_code null while some still store typed text. 120 DJs make
// the 100+ list the performance check needs; every 8th has a code, cycling the codes
// in use, and some have no photo or a long name.
// ---------------------------------------------------------------------------
const PROD_CODES = ['ES', 'CO', 'AR', 'EC', 'BO', 'ZA', 'IT', 'VE', 'GB', 'DE', 'CY', 'ES', 'CO', 'AR', 'CO', 'ES'];
const FIRST = ['Lucia', 'Camila', 'Marco', 'Sofia', 'Tom', 'Jan', 'Eva', 'Luca', 'Ana', 'Diego', 'Nadia', 'Kofi', 'Mei', 'Omar', 'Ines', 'Raul'];
const LAST = ['Moreno', 'Ruiz', 'Diaz', 'Vargas', 'Hughes', 'Kowalski', 'Condori', 'Bianchi', 'Silva', 'Torres', 'Haddad', 'Mensah', 'Chen', 'Farouk', 'Costa', 'Ortega'];
export const FLAG_PEOPLE = Array.from({ length: 120 }, (_, i) => {
  const coded = i % 8 === 0;
  const longName = i % 37 === 5;
  return {
    id: `f0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    first_name: longName ? 'Maria Fernanda de los Angeles' : FIRST[i % 16],
    surname: longName ? 'Rodriguez-Villanueva del Valle' : LAST[(i * 7) % 16],
    photo_url: i % 5 === 3 ? null : PHOTO,
    nationality_code: coded ? PROD_CODES[(i / 8) % PROD_CODES.length] : null,
    // Typed text kept on an unmapped row: the read says null, so no flag.
    nationality: coded ? PROD_CODES[(i / 8) % PROD_CODES.length] : i % 9 === 4 ? 'Kosovar' : null,
  };
});
export const FLAG_DJ_ID = FLAG_PEOPLE[0].id; // ES
export const FLAG_PEOPLE_CODED = FLAG_PEOPLE.filter((p) => p.nationality_code).length;
const fullName = (p) => `${p.first_name} ${p.surname}`;
const djListRow = (p) => ({
  id: p.id, display_name: null, dj_name: null, first_name: p.first_name, surname: p.surname, photo_url: p.photo_url,
  bio: null, genres: ['Bachata'], nationality: p.nationality, nationality_code: p.nationality_code,
  city_id: CITY_ID, city_name: 'London', city_slug: 'london-gb', person_entity_id: null,
});
// The organiser whose public "Teachers & DJs" circles carry flags (a table read:
// organiser_team_members + dancer_profiles.nationality, stored as alpha-2).
export const ORG3_ID = 'a0000000-0000-4000-8000-0000000000a5';
export const ORG3_SLUG = 'team-flags-phone-qa';
const ORG3_TEAM = [0, 1, 8, 16, 24, 2];
export const ORG3_TEAM_CODES = ORG3_TEAM.map((k) => FLAG_PEOPLE[k].nationality_code).filter(Boolean);
export const VENDOR_ID = 'b0000000-0000-4000-8000-0000000000b1';
// The rest of the person-photo surfaces (one fixture each, the same people and codes).
const coded = (n) => FLAG_PEOPLE.filter((p) => p.nationality_code).slice(0, n);
const mixed = (n) => FLAG_PEOPLE.slice(0, n);
export const FLAG_DANCER_ID = FLAG_PEOPLE[0].id; // ES, stored alpha-2
export const FLAG_EVENT_SLUG = 'flag-social-phone-qa';
export const FLAG_EVENT_ID = 'e2000000-0000-4000-8000-000000000001';
export const FLAG_FESTIVAL_SLUG = 'flag-festival-phone-qa';
export const FLAG_FESTIVAL_ID = 'e2000000-0000-4000-8000-000000000002';
const EVENT_REFS = { [FLAG_EVENT_SLUG]: FLAG_EVENT_ID, [FLAG_FESTIVAL_SLUG]: FLAG_FESTIVAL_ID };
const lineupOf = (people) => people.map((p) => ({ id: p.id, display_name: fullName(p), avatar_url: p.photo_url, nationality_code: p.nationality_code }));
// A night with a class (two teachers) and a party (two DJs). event_view_p5 legacy_compat carries
// nationality_code on every person (admin #774/#799), so the programme needs no second read.
const PROGRAMME_PEOPLE = [0, 8, 16, 1];
const flagSnapshot = (id, format) => {
  const occ = {
    occurrence_id: `${id.slice(0, -1)}9`, starts_at: '2099-11-20T20:00:00.000Z', ends_at: '2099-11-21T02:00:00.000Z', local_date: '2099-11-20',
    timezone: 'Europe/London', is_cancelled: false, is_live: false, is_past: false, is_upcoming: true,
    lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  };
  return {
    event_id: id, occurrence_id: occ.occurrence_id,
    event: {
      name: format === 'festival' ? 'Flag Festival Phone QA' : 'Flag Social Phone QA', description: null, date: null, type: format === 'festival' ? 'festival' : 'party', format,
      timezone: 'Europe/London', city_slug: 'london-gb', location: null, status: 'published', is_published: true, created_by: null,
      cover_image_url: null, hero_image_url: null, poster_url: null, photo_urls: [], music_styles: ['Bachata'], payment_methods: null, key_times: null,
      meta_data_public: {}, actions: { ticket_url: null, website_url: null, facebook_url: null, instagram_url: null, pricing: null },
    },
    organisers: [], occurrences: [occ], occurrence_effective: occ,
    location_default: { city: { name: 'London', slug: 'london-gb' }, venue: null, timezone: 'Europe/London' },
    attendance: { going_count: 0, interested_count: 0, current_user_status: null, preview: [] },
  };
};
const FLAG_PROGRAMME = [
  { id: 'p1', title: 'Bachata Sensual Improvers', type: 'class', start_time: '2099-11-20T20:00:00', end_time: '2099-11-20T21:00:00', day_event_date: '2099-11-20', sort_order: 1, levels: ['improver'], room: null,
    people: PROGRAMME_PEOPLE.slice(0, 2).map((k, i) => ({ profile_id: FLAG_PEOPLE[k].id, display_name: fullName(FLAG_PEOPLE[k]), avatar_url: FLAG_PEOPLE[k].photo_url, profile_type: 'teacher', level: null, sort_order: i, nationality_code: FLAG_PEOPLE[k].nationality_code })) },
  { id: 'p2', title: 'Social', type: 'party', start_time: '2099-11-20T21:00:00', end_time: '2099-11-21T02:00:00', day_event_date: '2099-11-20', sort_order: 2, levels: [], room: null,
    people: PROGRAMME_PEOPLE.slice(2).map((k, i) => ({ profile_id: FLAG_PEOPLE[k].id, display_name: fullName(FLAG_PEOPLE[k]), avatar_url: FLAG_PEOPLE[k].photo_url, profile_type: 'dj', level: null, sort_order: i, nationality_code: FLAG_PEOPLE[k].nationality_code })) },
];
export const FLAG_PROGRAMME_CODES = PROGRAMME_PEOPLE.map((k) => FLAG_PEOPLE[k].nationality_code).filter(Boolean);
export const FLAG_FESTIVAL_HEADLINERS = [...coded(5), FLAG_PEOPLE[1]];

/** Table rows, filtered by eq./is./in. query params. Shapes follow the public column lists. */
const HERO_BASE = {
  first_name: null, surname: null, bio: 'Weekly socials.', short_bio: 'Weekly socials.', website: null, instagram: 'bachataplayground',
  facebook: null, whatsapp: null, email: null, phone: null, photo_url: null, avatar_url: null, cover_url: null, gallery_urls: [],
  city_id: CITY_ID, is_active: true, lifecycle_status: 'live', team_member_ids: [], created_at: '2024-01-01T00:00:00Z',
  organisation_category: HERO_CATEGORY, founded_year: 2012,
};

export const TABLES = {
  organiser_profiles: [
    {
      id: ORG_ID,
      slug: ORG_SLUG,
      name: 'Ritmo Phone QA',
      organisation_name: 'Ritmo Phone QA',
      first_name: null,
      surname: null,
      bio: LONG,
      short_bio: LONG.slice(0, 120),
      website: 'https://example.org/ritmo',
      instagram: 'ritmo',
      facebook: null,
      whatsapp: null,
      email: null,
      phone: null,
      photo_url: null,
      avatar_url: null,
      cover_url: null,
      gallery_urls: [],
      city_id: CITY_ID,
      is_active: true,
      lifecycle_status: 'live',
      team_member_ids: [],
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: ORG2_ID,
      slug: ORG2_SLUG,
      name: 'Salsa Nights Phone QA',
      organisation_name: 'Salsa Nights Phone QA',
      first_name: null,
      surname: null,
      bio: 'Monthly socials.',
      short_bio: 'Monthly socials.',
      website: null,
      instagram: 'salsanights',
      facebook: null,
      whatsapp: null,
      email: null,
      phone: null,
      photo_url: null,
      avatar_url: null,
      cover_url: null,
      gallery_urls: [],
      city_id: CITY_ID,
      is_active: true,
      lifecycle_status: 'live',
      team_member_ids: [],
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      ...HERO_BASE,
      id: HERO_ORGS[0].id,
      slug: HERO_ORGS[0].slug,
      name: HERO_ORGS[0].name,
      organisation_name: HERO_ORGS[0].name,
    },
    {
      ...HERO_BASE,
      id: HERO_ORGS[1].id,
      slug: HERO_ORGS[1].slug,
      name: HERO_ORGS[1].name,
      organisation_name: HERO_ORGS[1].name,
    },
    {
      ...HERO_BASE,
      id: ORG3_ID,
      slug: ORG3_SLUG,
      name: 'Team Flags Phone QA',
      organisation_name: 'Team Flags Phone QA',
    },
  ],
  organiser_team_members: ORG3_TEAM.map((k, i) => ({
    id: `e1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, organiser_profile_id: ORG3_ID, member_profile_id: FLAG_PEOPLE[k].id,
    role: i % 2 ? 'DJ' : 'Teacher', is_head: i === 0, is_leader: false, sort_order: i, is_active: true,
  })),
  dancer_profiles: FLAG_PEOPLE.slice(0, 30).map((p) => ({
    id: p.id, first_name: p.first_name, surname: p.surname, display_name: fullName(p), avatar_url: p.photo_url, nationality: p.nationality,
    is_active: true, dance_role: 'both', based_city_id: CITY_ID, cities: { name: 'London' }, city: { name: 'London' },
    // /practice-partners filters on the embedded table (dancing_role_details!inner); the fake matches the dotted key.
    dancing_role_details: { favorite_styles: ['Bachata'], looking_for_partner: true, dance_started_year: 2020 },
    'dancing_role_details.looking_for_partner': true,
  })),
  videographers: mixed(8).map((p, i) => ({
    id: p.id, first_name: p.first_name, surname: p.surname, business_name: i === 1 ? null : `${p.first_name} Films`, photo_url: p.photo_url ?? PHOTO, bio: null,
    instagram: null, website: null, verified: i === 0, videography_styles: ['Socials'], nationality: i % 3 === 0 ? (p.nationality_code ?? 'CO') : p.nationality, is_active: true,
    created_at: '2025-01-01T00:00:00Z',
  })),
  cities: [
    { id: CITY_ID, name: 'London', slug: 'london-gb', country_code: 'GB', is_active: true, timezone: 'Europe/London' },
    { id: CITY2_ID, name: 'Manchester', slug: 'manchester-gb', country_code: 'GB', is_active: true, timezone: 'Europe/London' },
  ],
};

/** RPC answers by name. Anything unlisted answers [], unless it looks like a write. */
export const RPCS = {
  organiser_ownership_v1: { is_managed: true, i_own_it: true, my_role: 'owner' },
  // /city/:slug 404s unless the DB vouches for the slug (app/routes/home.tsx).
  is_valid_city_slug: true,
  // The owner's private contact (admin #771 shape: both split flags, plus the
  // deprecated derived show_contact_publicly). ORG has a phone and an email; every
  // other organiser has an email only, so its phone switch is disabled with a reason.
  get_organiser_contact_settings_v1: (args) => (args.p_organiser_id === ORG_ID
    ? { contact_phone: '+44 7700 900123', contact_email: 'hello@example.com', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }
    : { contact_phone: null, contact_email: 'hello@example.com', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }),
  search_cities: (args) => searchCityRows(args.p_query, args.p_limit),
  // The signed-in owner's team read (organiser_team_v1): they are the sole owner, as on 3 of 4 managed organisers on prod.
  organiser_team_v1: (args) => ({
    organiser_id: args.p_organiser_id,
    my_role: 'owner',
    members: [{ user_id: '11111111-1111-4111-8111-111111111111', member_role: 'owner', is_primary: true, joined_at: '2026-01-01T00:00:00Z', is_me: true, email: 'owner@ritmo.example' }],
  }),
  organiser_team_search_people_v1: (args) => searchPeopleRows(args.p_query, args.p_limit),
  // Nationality flags: the reads' prod shapes (admin #774), nationality_code additive.
  list_public_djs_v1: () => FLAG_PEOPLE.map(djListRow),
  get_public_dj_v1: (args) => {
    const p = FLAG_PEOPLE.find((x) => x.id === args.p_dj_id) ?? null;
    return p ? { ...djListRow(p), faq: null, pricing: null, website: null, facebook: null, mixcloud: null, cover_url: null, instagram: null, languages: [], soundcloud: null, achievements: [], gallery_urls: [], upcoming_events: [] } : null;
  },
  get_public_vendor_detail_v1: () => [{
    id: VENDOR_ID, business_name: 'Flag Shoes Phone QA', city: 'London', team: FLAG_PEOPLE.slice(0, 9).map((p, i) => ({
      dancer_id: p.id, name: fullName(p), avatar_url: p.photo_url, nationality_code: p.nationality_code, city: 'London', role: i === 0 ? 'Owner' : 'Staff', is_leader: i === 0,
    })),
    product_categories: [], products: [], faq: [],
  }],
  get_public_teachers_list_v1: () => mixed(40).map((p) => ({
    entity_id: p.id, first_name: p.first_name, surname: p.surname, hide_surname: false, photo_url: p.photo_url, city: 'London', nationality: p.nationality,
    nationality_code: p.nationality_code, years_teaching: 5, teaching_styles: ['Bachata'], offers_group: true, offers_private: false, languages: [], instagram: null, website: null,
  })),
  get_all_profiles_v1: () => mixed(24).map((p, i) => ({
    profile_id: p.id, role: ['teacher', 'dj', 'dancer'][i % 3], display_name: fullName(p), photo_url: p.photo_url ?? PHOTO, city_name: 'London', country_code: 'GB',
    bio: null, specialties: [], is_verified: false, nationality_code: p.nationality_code ?? (i % 3 === 1 ? 'CO' : null),
  })),
  // By slug or by id (/event/<uuid>, the link shape the build smoke opens).
  resolve_public_event_ref_v1: (args) => {
    const slug = EVENT_REFS[args.p_param] ? args.p_param : Object.keys(EVENT_REFS).find((s) => EVENT_REFS[s] === args.p_param);
    return slug ? { id: EVENT_REFS[slug], slug } : null;
  },
  event_view_p5: (args) => {
    const t = args.p_target ?? {};
    const id = Object.values(EVENT_REFS).find((x) => x === t.series_id || (t.occurrence_id && t.occurrence_id === `${x.slice(0, -1)}9`));
    if (!id) return null;
    if (args.p_viewer?.shape === 'snapshot_compat') return flagSnapshot(id, id === FLAG_FESTIVAL_ID ? 'festival' : 'party');
    return id === FLAG_EVENT_ID ? FLAG_PROGRAMME : [];
  },
  get_public_festival_detail_v2: (args) => (args.p_event_id === FLAG_FESTIVAL_ID ? {
    event_id: FLAG_FESTIVAL_ID,
    identity: { name: 'Flag Festival Phone QA', music_styles: ['Bachata'] },
    dates: { starts_at: '2099-11-20T18:00:00Z', ends_at: '2099-11-22T23:00:00Z', local_start: '2099-11-20T18:00:00', local_end: '2099-11-22T23:00:00', timezone: 'Europe/London' },
    links: {}, location: { city: { id: CITY_ID, name: 'London', slug: 'london-gb' } }, organiser: null,
    lineup: { teachers: lineupOf(FLAG_FESTIVAL_HEADLINERS), djs: lineupOf(coded(3)), performers: [], mcs: [], photographers: [], videographers: [] },
    schedule: [], passes: [], venues: [], hotels: [], competitions: [], promo_codes: [], publish: {},
  } : null),
  search_public_v4: (args) => {
    const q = String(args.p_query ?? '').toLowerCase();
    const rows = FLAG_PEOPLE.filter((p) => fullName(p).toLowerCase().includes(q)).slice(0, Number(args.p_section_limit) || 12)
      .map((p) => ({ id: p.id, first_name: p.first_name, surname: p.surname, display_name: null, photo_url: p.photo_url, avatar_url: null, slug: null, nationality_code: p.nationality_code }));
    return { query: q, events: [], organisers: [], teachers: rows.slice(0, 4), djs: rows.slice(4, 8), dancers: rows.slice(8), venues: [], vendors: [], cities: [], total_count: rows.length };
  },
  // ORG2's nights: no dated occurrence rows, so the page lists them as upcoming
  // (the base-date fallback); every other organiser has none.
  get_organiser_public_events_v1: (args) => (args.p_organiser_id === ORG2_ID ? [
    { id: 'e0000000-0000-4000-8000-0000000000e1', name: 'Friday Salsa Social', date: '2099-01-02', start_time: '2099-01-02T20:00:00', is_active: true, poster_url: null, location: 'Studio One', city: 'London' },
    { id: 'e0000000-0000-4000-8000-0000000000e2', name: 'Saturday Bachata Party', date: '2099-01-03', start_time: '2099-01-03T21:00:00', is_active: true, poster_url: null, location: 'Studio One', city: 'London' },
  ] : []),
};

// ---------------------------------------------------------------------------
// "Almost live" / Go live (/account/o/go-live?series=..., invite W2): the reads the
// flow makes, per SCENARIO, served browser side only (helpers.ts `goLive`), so no
// other spec's /account/o changes. Shapes copied from GoLiveRoles.test.tsx and
// tests/e2e/helpers/organiserFake.ts. Go live itself (series_command_p5) answers ok
// (and the role answers) ONLY in a scenario that sets `liveOk`; every other write stays refused.
// ---------------------------------------------------------------------------
export const GOLIVE_SERIES_ID = '5e000000-0000-4000-8000-0000000000f1';
export const GOLIVE_EVENT_NAME = 'Friday Bachata Social';
const GOLIVE_USER_ID = '11111111-1111-4111-8111-111111111111';
const goLiveDancer = () => ({
  profile_id: 'd0000000-0000-4000-8000-0000000000f1', user_id: GOLIVE_USER_ID, first_name: 'Ana', surname: 'Ruiz', based_city_id: CITY_ID,
  dance_role: 'Follower', avatar_url: PHOTO, nationality: 'ES', languages: ['English'], instagram: 'ana.ruiz', whatsapp: null,
  phone: '+447700900456', dance_started_year: 2019, other_roles: ['organiser'],
});

/**
 * @param {{ steps?: [string, string][], contactPhone?: string | null, intent?: {roles: string[], declined: string[]},
 *   missing?: {area: string, organiser_id: string | null, fields: string[]}[], liveOk?: boolean }} sc
 * @returns {Record<string, (args: Record<string, unknown>) => unknown>}
 */
export const goLiveRpcs = (sc) => {
  const steps = (sc.steps ?? []).map(([area, field]) => ({ area, field, required: true, done: false }));
  const missing = sc.missing ?? [];
  // Go live flips the series to live, so the reads after it (Done's "See it live") say so.
  let lifecycle = 'draft';
  return {
    organiser_home_v1: () => ({
      today: '2026-10-23',
      organisers: [{
        id: ORG_ID, name: 'Ritmo Phone QA', slug: ORG_SLUG, avatar_url: null, city_id: CITY_ID, lifecycle_status: 'live', role: 'owner',
        is_primary: true, joined_at: '2026-01-01T00:00:00Z', latest_decision: null, team: [],
        series: [{ id: GOLIVE_SERIES_ID, name: GOLIVE_EVENT_NAME, slug: 'friday-bachata-social', format: 'social', category: 'party', lifecycle_status: lifecycle,
          default_local_start_time: '20:00:00', default_venue_name: 'Studio One', upcoming_count: 0, latest_decision: null, version: 3, next_dates: [] }],
      }],
    }),
    // The dancer-first gate: a finished dancer profile.
    _my_dancer_profile_id_v1: () => goLiveDancer().profile_id,
    profile_complete_v1: () => true,
    get_current_user_organiser_ids: () => [ORG_ID],
    my_profile_progress_v1: () => ({ percent: 60, required_left: steps.length, publish_ready: steps.length === 0, declined: [], steps }),
    my_dancer_edit_v1: () => goLiveDancer(),
    my_role_intent_v1: () => sc.intent ?? { roles: ['dancer', 'organiser'], declined: [] },
    my_roles_v1: () => [],
    get_organiser_contact_settings_v1: () => ({
      contact_phone: sc.contactPhone ?? null, contact_email: 'hello@example.com', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null,
    }),
    series_go_live_check_v1: () => ({ ready: missing.length === 0, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: missing }),
    admin_event_workspace_p5: () => ({
      meta: { version: 3, has_more: false },
      series: {
        series: { id: GOLIVE_SERIES_ID, organiser_id: ORG_ID, name: GOLIVE_EVENT_NAME, slug: 'friday-bachata-social', format: 'social', category: 'party',
          lifecycle_status: lifecycle, version: 3, default_venue_id: null, default_description: null, default_local_start_time: '20:00:00', default_duration: null,
          default_level: null, default_cover_image_url: null, instagram_url: null, passes: null, created_at: '2026-10-01T10:00:00+00:00',
          gallery: [], video_urls: [], default_music_styles: ['Bachata'] },
        program: [],
      },
      occurrences: [],
    }),
    // `liveOk`: Go live and the role answers on the way succeed (echoing what was sent), so "It's live" can render.
    ...(sc.liveOk ? {
      series_command_p5: () => { lifecycle = 'live'; return { ok: true, data: {}, audit_id: 'a', new_version: 4 }; },
      set_my_role_intent_v1: () => null,
      my_role_details_v1: (a) => ({ role: a.p_role, person_id: 'p1', details: {} }),
      save_my_role_v1: (a) => ({ role: a.p_role, person_id: 'p1', changed: true, changed_keys: Object.keys(a.p_patch ?? {}), details: a.p_patch ?? {} }),
    } : {}),
  };
};

/** RPCs that change state are refused, so an accidental Save can never "succeed" here. */
const WRITE_RPC_RE = /^(?:record|save|create|update|delete|remove|upsert|insert|submit|set|claim|redeem|upload|add|cancel|publish|invite|accept|reject|transfer|rate|vote)_/;

/** The organiser team writes (their names do not start with a write verb). */
const TEAM_WRITE_RPC_RE = /^organiser_(?:team_(?:add|set|remove)_|transfer_)/;

const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function matches(row, key, raw) {
  const v = row[key];
  const m = /^(not\.)?(eq|is|in|neq)\.(.*)$/.exec(raw);
  if (!m) return true; // select=, order=, limit= and anything we do not model
  const [, not, op, arg] = m;
  let hit;
  // `raw` comes from URLSearchParams, already decoded: decoding again throws on a literal %.
  if (op === 'eq') hit = String(v) === arg;
  else if (op === 'neq') hit = String(v) !== arg;
  else if (op === 'is') hit = arg === 'null' ? v == null : String(v) === arg;
  else hit = arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, '')).includes(String(v));
  return not ? !hit : hit;
}

/** The JSON body of an RPC call ({} when there is none or it is not JSON). */
function rpcArgs(body) {
  try {
    const v = JSON.parse(body || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/**
 * @param {{method: string, url: string, headers?: Record<string, string>, body?: string | null}} req
 * @returns {{status: number, headers: Record<string,string>, body: string}}
 */
export function answer(req) {
  const url = new URL(req.url);
  const method = (req.method || 'GET').toUpperCase();
  const accept = (req.headers?.accept || req.headers?.Accept || '').toLowerCase();
  const path = url.pathname;
  if (path.startsWith('/auth/v1/')) return json(200, {});
  if (path.startsWith('/rest/v1/rpc/')) {
    const name = path.slice('/rest/v1/rpc/'.length);
    if (WRITE_RPC_RE.test(name) || TEAM_WRITE_RPC_RE.test(name)) return json(403, { message: `fake supabase: write RPC ${name} is refused` });
    if (!Object.prototype.hasOwnProperty.call(RPCS, name)) return json(200, []);
    const a = RPCS[name];
    // A function answer reads the call's arguments (POST body, or GET query params).
    if (typeof a === 'function') return json(200, a(method === 'GET' ? Object.fromEntries(url.searchParams) : rpcArgs(req.body)));
    return json(200, a);
  }
  if (path.startsWith('/rest/v1/')) {
    if (method !== 'GET' && method !== 'HEAD') return json(403, { message: 'fake supabase: writes are refused' });
    const table = path.slice('/rest/v1/'.length);
    let rows = TABLES[table] ?? [];
    for (const [k, raw] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      rows = rows.filter((r) => matches(r, k, raw));
    }
    const limit = Number(url.searchParams.get('limit'));
    if (limit > 0) rows = rows.slice(0, limit);
    if (accept.includes('vnd.pgrst.object')) {
      return rows.length === 1
        ? json(200, rows[0])
        : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows`, hint: null });
    }
    return { ...json(200, rows), headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } };
  }
  return json(404, { message: 'fake supabase: no such endpoint' });
}
