import { describe, expect, it } from 'vitest';
import { parseMyDancerEdit } from '../../../api/rpc';
import { SAVE_KEYS } from '../../../api/types';
import {
  PARTNER_HINT, PARTNER_YEARS_V3, STEPS_V3, YEAR_BANDS_V3, bandForYearV3, celebratesOnLeave, partnerContinue, partnerMissing, partnerSaveAdvances, resumeStep, stepIsSatisfied, stepsFor, yearForBandV3, type DraftV3,
} from '../modelV3';
import { DANCER_ONBOARDING_V3_ENABLED } from '../onboardingV3Flag';

const base = { profile_id: 'p1', user_id: 'u1', display_name: 'A', first_name: 'A', favorite_styles: ['sensual'], buyer_roles: ['dancer'], bio: 'hi', dance_started_year: 2020 };

describe('flag', () => {
  it('is off unless the env var is exactly "true"', () => expect(DANCER_ONBOARDING_V3_ENABLED).toBe(false));
});

describe('parser partner keys', () => {
  it('absent keys -> null / []', () => {
    const e = parseMyDancerEdit(base);
    expect([e.looking_for_partner, e.partner_search_role, e.partner_years_min, e.partner_years_max, e.partner_details]).toEqual([null, null, null, null, null]);
    expect(e.partner_practice_goals).toEqual([]);
  });
  it('wrong types -> null / [] and never throws', () => {
    const e = parseMyDancerEdit({ ...base, looking_for_partner: 'yes', partner_search_role: 3, partner_years_min: '2', partner_years_max: null, partner_details: {}, partner_practice_goals: 'x' });
    expect(e.looking_for_partner).toBeNull();
    expect(e.partner_search_role).toBeNull();
    expect(e.partner_years_min).toBeNull();
    expect(e.partner_details).toBeNull();
    expect(e.partner_practice_goals).toEqual([]);
  });
  it('right types pass through', () => {
    const e = parseMyDancerEdit({ ...base, looking_for_partner: true, partner_search_role: 'follower', partner_years_min: 1, partner_years_max: 5, partner_details: 'hi', partner_practice_goals: ['a', 2, 'b'] });
    expect(e).toMatchObject({ looking_for_partner: true, partner_search_role: 'follower', partner_years_min: 1, partner_years_max: 5, partner_details: 'hi', partner_practice_goals: ['a', 'b'] });
  });
  it('existing fields are unchanged', () => {
    const e = parseMyDancerEdit(base);
    expect(e).toMatchObject({ profile_id: 'p1', display_name: 'A', favorite_styles: ['sensual'], buyer_roles: ['dancer'], bio: 'hi', dance_started_year: 2020, is_active: true, show_whatsapp_publicly: true });
  });
  it('save keys include the six partner keys, not the retired level', () => {
    for (const k of ['looking_for_partner', 'partner_search_role', 'partner_years_min', 'partner_years_max', 'partner_details', 'partner_practice_goals']) expect(SAVE_KEYS as readonly string[]).toContain(k);
    expect(SAVE_KEYS as readonly string[]).not.toContain('partner_search_level');
  });
});

describe('steps', () => {
  it('order', () => expect([...STEPS_V3]).toEqual(['roles', 'styles', 'years', 'partner', 'photo', 'bio']));
  it('partner is shown to every role (v8)', () => {
    expect(stepsFor(['dancer', 'dj'])).toHaveLength(6);
    expect(stepsFor(['organiser'])).toEqual([...STEPS_V3]);
    expect(stepsFor([])).toContain('partner');
  });
});

describe('year bands', () => {
  it('labels verbatim', () => expect(YEAR_BANDS_V3.map((b) => b.label)).toEqual(['Under 1 year', '1 to 2 years', '3 to 5 years', '6 to 10 years', 'Over 10 years']));
  it('stores 2026, 2024, 2021, 2016, 2010 in 2026', () => expect(YEAR_BANDS_V3.map((b) => yearForBandV3(b.id, 2026))).toEqual([2026, 2024, 2021, 2016, 2010]));
  it('round-trips', () => { for (const b of YEAR_BANDS_V3) expect(bandForYearV3(yearForBandV3(b.id, 2026), 2026)).toBe(b.id); });
  it('null and future years', () => { expect(bandForYearV3(null, 2026)).toBeNull(); expect(bandForYearV3(2030, 2026)).toBe('under-1'); });
  it('edges', () => { expect(bandForYearV3(2023, 2026)).toBe('three-five'); expect(bandForYearV3(2015, 2026)).toBe('over-10'); expect(bandForYearV3(2016, 2026)).toBe('six-ten'); });
});

describe('required', () => {
  const d: DraftV3 = { roles: [], styles: [], band: null, lookingForPartner: null, partnerRole: null, hasPhoto: false };
  it('each gate', () => {
    expect(stepIsSatisfied('roles', d)).toBe(false);
    expect(stepIsSatisfied('roles', { ...d, roles: ['dj'] })).toBe(true);
    expect(stepIsSatisfied('styles', d)).toBe(false);
    expect(stepIsSatisfied('styles', { ...d, styles: ['x'] })).toBe(true);
    expect(stepIsSatisfied('years', d)).toBe(false);
    expect(stepIsSatisfied('years', { ...d, band: 'over-10' })).toBe(true);
    expect(stepIsSatisfied('photo', d)).toBe(false);
    expect(stepIsSatisfied('photo', { ...d, hasPhoto: true })).toBe(true);
    expect(stepIsSatisfied('bio', d)).toBe(true);
  });
  it('partner needs an answer; yes needs a role', () => {
    expect(stepIsSatisfied('partner', d)).toBe(false);
    expect(stepIsSatisfied('partner', { ...d, lookingForPartner: false })).toBe(true);
    expect(stepIsSatisfied('partner', { ...d, lookingForPartner: true })).toBe(false);
    expect(stepIsSatisfied('partner', { ...d, lookingForPartner: true, partnerRole: 'leader' })).toBe(false);
  });
  it('partner yes needs kind + role + years', () => {
    const y = { ...d, lookingForPartner: true, partnerRole: 'Leader', partnerKinds: ['Practice'], partnerYears: '2-5' };
    expect(stepIsSatisfied('partner', y)).toBe(true);
    expect(stepIsSatisfied('partner', { ...y, partnerYears: null })).toBe(false);
    expect(stepIsSatisfied('partner', { ...y, partnerKinds: [] })).toBe(false);
    expect(partnerContinue(y)).toBe('advance');
    expect(partnerContinue({ ...y, partnerRole: null })).toBe('reopen-sheet');
    expect(partnerContinue({ ...d, lookingForPartner: false })).toBe('advance');
    expect(partnerContinue(d)).toBe('blocked');
    expect(partnerSaveAdvances).toBe(true);
  });
  it('PARTNER_HINT exact strings', () => {
    expect(partnerMissing(d)).toEqual(['a kind', 'their role', 'years dancing']);
    expect(PARTNER_HINT(['a kind', 'their role', 'years dancing'])).toBe('Pick a kind, their role and years dancing to save.');
    expect(PARTNER_HINT(['their role', 'years dancing'])).toBe('Pick their role and years dancing to save.');
    expect(PARTNER_HINT(['a kind'])).toBe('Pick a kind to save.');
  });
  it('years labels match the sheet', () => expect(PARTNER_YEARS_V3.map((x) => x.label)).toEqual(['0-2', '2-5', '5+', 'Any']));
});

describe('celebratesOnLeave', () => {
  it('rules', () => {
    const none = { bio: false, link: false };
    expect(celebratesOnLeave('roles', { bio: true, link: true })).toBe(false);
    for (const s of ['styles', 'years', 'partner', 'photo'] as const) expect(celebratesOnLeave(s, none)).toBe(true);
    expect(celebratesOnLeave('bio', none)).toBe(false);
    expect(celebratesOnLeave('bio', { bio: true, link: false })).toBe(true);
    expect(celebratesOnLeave('bio', { bio: false, link: true })).toBe(true);
  });
});

describe('resumeStep', () => {
  const full = { buyer_roles: ['dancer'] as const, favorite_styles: ['x'], dance_started_year: 2020, avatar_url: 'u', looking_for_partner: false };
  const p = (o: object) => ({ ...full, buyer_roles: ['dancer'] as ('dancer')[], ...o }) as Parameters<typeof resumeStep>[0];
  it('walks the missing list', () => {
    expect(resumeStep(p({ buyer_roles: [] }))).toBe('roles');
    expect(resumeStep(p({ favorite_styles: [] }))).toBe('styles');
    expect(resumeStep(p({ dance_started_year: null }))).toBe('years');
    expect(resumeStep(p({ looking_for_partner: null }))).toBe('partner');
    expect(resumeStep(p({ looking_for_partner: undefined }))).toBe('partner');
    expect(resumeStep(p({ avatar_url: null }))).toBe('photo');
    expect(resumeStep(p({}))).toBe('done');
  });
  it('non-dancer never stops at partner; bio never missing', () => {
    expect(resumeStep(p({ buyer_roles: ['dj'], looking_for_partner: null }))).toBe('done');
  });
});
