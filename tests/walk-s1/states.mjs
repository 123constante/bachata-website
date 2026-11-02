// Walk S1 (PR #1282): per-state fake feeds for /organisers/:slug. Layered over the
// phone suite's fakeSupabase answer(): only the three feeds + team roster differ.
// `fail` names the feeds that answer HTTP 500 until `healed` (browser side only;
// SSR is stateless and always fails them, so a failing feed is also not dehydrated).
import { answer, TABLES, FLAG_PEOPLE, CITY_ID } from '../e2e-phone/fakeSupabase.mjs';

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const occ = (org, k, n, past) => ({
  event_id: `e5000000-0000-4000-8000-${org}${String(k).padStart(2, '0')}`, name: `${past ? 'Past' : 'Next'} Social ${k}`,
  occurrence_id: `f5000000-0000-4000-8000-${org}${String(k).padStart(2, '0')}`, instance_date: day(n), start_time: `${day(n)}T20:00:00`,
  photo_url: null, cover_image_url: null, location: 'Studio One', is_cancelled: false, is_past: past,
});
const legacy = (o) => ({ id: o.event_id, name: o.name, date: o.instance_date, start_time: o.start_time, is_active: true, poster_url: null, location: o.location, city: 'London' });

const UP = (org) => [occ(org, 1, 3, false), occ(org, 2, 10, false), occ(org, 3, 17, false)];
const PAST = (org) => [occ(org, 4, -7, true), occ(org, 5, -14, true), occ(org, 6, -21, true), occ(org, 7, -400, true)];

// key, label, fail (cal = upcoming feed, past = past feed, events = legacy events feed, team), data, owner
export const STATES = [
  { key: 'all-ok', label: 'all ok, upcoming + past', fail: [], up: true, past: true, team: true },
  { key: 'up-fail', label: 'upcoming feed fails', fail: ['cal'], up: true, past: true },
  { key: 'past-fail', label: 'past feed fails', fail: ['past'], up: true, past: true },
  { key: 'events-fail', label: 'events feed fails (both lists)', fail: ['events'], up: true, past: true },
  { key: 'team-fail', label: 'team roster fails', fail: ['team'], up: true, past: true },
  { key: 'all-fail', label: 'all fail', fail: ['cal', 'past', 'events', 'team'], up: true, past: true },
  { key: 'empty-none', label: 'real empty: no events', fail: [] },
  { key: 'empty-past-only', label: 'real empty: past only', fail: [], past: true },
  { key: 'owner-no-bio', label: 'claimed owner, no bio', fail: [], up: true, past: true, owner: true, noBio: true },
].map((s, i) => ({ ...s, id: `a0000000-0000-4000-8000-0000000005${String(i + 1).padStart(2, '0')}`, slug: `s1-${s.key}-walk`, tag: String(i + 1).padStart(2, '0') }));

STATES.forEach((s) => {
  TABLES.organiser_profiles.push({
    ...TABLES.organiser_profiles[0], id: s.id, slug: s.slug, name: `Walk S${s.tag}`, organisation_name: `Walk ${s.key}`,
    bio: s.noBio ? null : 'Weekly bachata in Soho.', short_bio: s.noBio ? null : 'Weekly bachata in Soho.', website: null, instagram: null, city_id: CITY_ID,
  });
  if (s.team) [0, 1].forEach((k) => TABLES.organiser_team_members.push({
    id: `e1000000-0000-4000-8000-9${s.tag}0000000${k}`, organiser_profile_id: s.id, member_profile_id: FLAG_PEOPLE[k].id,
    role: k ? 'DJ' : 'Teacher', is_head: k === 0, is_leader: false, sort_order: k, is_active: true,
  }));
});

const err = { status: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'walk: feed failed', code: 'XX000' }) };
const ok = (b) => ({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

export function walkAnswer(req, healed = false) {
  const url = new URL(req.url);
  const rpc = url.pathname.startsWith('/rest/v1/rpc/') ? url.pathname.slice('/rest/v1/rpc/'.length) : null;
  let args = {};
  try { args = JSON.parse(req.body || '{}'); } catch { /* none */ }
  const failing = (s, f) => !healed && s.fail.includes(f);
  if (rpc === 'get_organiser_calendar_events_v1' || rpc === 'get_organiser_public_events_v1') {
    const s = STATES.find((x) => x.id === args.p_organiser_id);
    if (!s) return answer(req);
    if (rpc === 'get_organiser_public_events_v1') {
      if (failing(s, 'events')) return err;
      return ok([...(s.up ? UP(s.tag) : []), ...(s.past ? PAST(s.tag) : [])].map(legacy));
    }
    const isPast = args.p_include_past === true;
    if (failing(s, isPast ? 'past' : 'cal')) return err;
    return ok(isPast ? (s.past ? PAST(s.tag) : []) : (s.up ? UP(s.tag) : []));
  }
  if (url.pathname === '/rest/v1/organiser_team_members') {
    const id = (url.searchParams.get('organiser_profile_id') ?? '').replace('eq.', '');
    const s = STATES.find((x) => x.id === id);
    if (s && failing(s, 'team')) return err;
  }
  return answer(req);
}
