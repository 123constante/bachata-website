/**
 * Owner decision 2026-10-23 (review R6): every dancer's completion % on /account
 * is the SAME number main showed for the same profile. The oracle below is
 * main's code (DancerDashboard.tsx before Going P2, lines 475-500), copied as
 * it was; main's "activity" input was its attendance list, which here is the
 * viewer's going nights. Table-driven over the profile shapes prod has
 * (2026-10-23 read-only survey: 189 profiles in 10 shapes) plus the edges.
 */
import { describe, expect, it } from 'vitest';
import { dancerCompletion, type CompletionProfile } from '@/lib/profileCompletion';

type MainProfile = NonNullable<CompletionProfile>;
type MainAttendance = { status: 'going' | 'interested' };

// ---- main's code, verbatim except for the inputs it closed over ----
function mainCompletion(profile: MainProfile | null, allAttendance: MainAttendance[]) {
  const hasIdentity = Boolean(profile?.first_name?.trim()) && Boolean(profile?.based_city_id);
  const hasMedia = Boolean(profile?.photo_url?.trim());
  const hasActivity = allAttendance.length > 0;
  const hasEngagement = Boolean(profile?.looking_for_partner) || Boolean(profile?.dance_role);
  const hasSocial = Boolean(profile?.instagram || profile?.facebook || profile?.whatsapp || profile?.website);

  const completionSteps = [hasIdentity, hasMedia, hasActivity, hasEngagement, hasSocial];
  const completionCount = completionSteps.filter(Boolean).length;
  const completionPercent = Math.round((completionCount / completionSteps.length) * 100);
  return { completionCount, completionPercent };
}
// --------------------------------------------------------------------

const id = { first_name: 'Ana', based_city_id: 'city-1' };
const photo = { photo_url: 'https://x/p.jpg' };
const engage = { dance_role: 'follower' };
const social = { instagram: 'ana' };

const PROFILES: [string, MainProfile | null][] = [
  // the 10 prod shapes (identity, media, engagement, social)
  ['nothing (prod 62)', {}],
  ['identity+media+social (prod 47)', { ...id, ...photo, ...social }],
  ['identity+media+engagement (prod 24)', { ...id, ...photo, ...engage }],
  ['identity+media (prod 15)', { ...id, ...photo }],
  ['media+social (prod 13)', { ...photo, ...social }],
  ['media only (prod 10)', { ...photo }],
  ['all four (prod 9)', { ...id, ...photo, ...engage, ...social }],
  ['identity only (prod 4)', { ...id }],
  ['identity+engagement (prod 3)', { ...id, ...engage }],
  ['media+engagement (prod 1)', { ...photo, ...engage }],
  // edges each test reads
  ['name but no city', { first_name: 'Ana' }],
  ['whitespace name and photo', { first_name: '   ', based_city_id: 'c', photo_url: '  ' }],
  ['partner mode on, no role', { looking_for_partner: true }],
  ['whatsapp only', { whatsapp: '+44' }],
  ['website only', { website: 'https://a.b' }],
  ['facebook only', { facebook: 'ana' }],
  ['nulls everywhere', { first_name: null, based_city_id: null, photo_url: null, dance_role: null, instagram: null }],
  ['no profile', null],
];
const NIGHTS: [string, number, MainAttendance[]][] = [
  ['no nights', 0, []],
  ['one night', 1, [{ status: 'going' }]],
  ['three nights', 3, [{ status: 'going' }, { status: 'going' }, { status: 'going' }]],
];

const CELLS = PROFILES.flatMap(([p, profile]) => NIGHTS.map(([n, count, rows]) => ({ p, n, profile, count, rows })));

describe('dancerCompletion matches main for every profile shape x night count', () => {
  it.each(CELLS)('$p | $n', ({ profile, count, rows }) => {
    const want = mainCompletion(profile, rows);
    const got = dancerCompletion(profile, count);
    expect(got.percent).toBe(want.completionPercent);
    expect(got.count).toBe(want.completionCount);
    expect(got.total).toBe(5);
  });

  it('the percent steps are main\'s: 0, 20, 40, 60, 80, 100', () => {
    const seen = new Set(CELLS.map(({ profile, count }) => dancerCompletion(profile, count).percent));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 20, 40, 60, 80, 100]);
  });
});
