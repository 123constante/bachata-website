import { describe, expect, it } from 'vitest';
import { buildDashboardSectionPayload, buildCreateProfilePayload, type DancerEditorForm } from '@/lib/dancerEditorPayloads';
import { buildDancerProfilePayload } from '@/lib/saveMyDancerProfile';

const form: DancerEditorForm = {
  first_name: 'A', surname: 'B', city: '', instagram: '', facebook: '', whatsapp: '', website: '',
  dancing_start_date: '', partner_role: '', achievements: [], favorite_songs: [],
  partner_search_role: 'Leader', partner_search_level: ['Advanced'], partner_years_min: 2, partner_years_max: 5,
  partner_practice_goals: ['Socials'], partner_details: 'hi', favorite_styles: [], looking_for_partner: true, photo_url: '',
};
const keys = (p: any) => Object.keys(p.dancer_details).sort();
const KEEP = ['looking_for_partner', 'partner_details', 'partner_practice_goals', 'partner_search_role'];

describe('level retired, partner payload (keep-list)', () => {
  it('flag off: level sent, no years', () => {
    expect(keys(buildDashboardSectionPayload('partner', form, { levelRetired: false }))).toEqual([...KEEP, 'partner_search_level'].sort());
  });
  it('flag on: years sent, no level, every other key kept', () => {
    const p: any = buildDashboardSectionPayload('partner', form, { levelRetired: true });
    expect(keys(p)).toEqual([...KEEP, 'partner_years_max', 'partner_years_min'].sort());
    expect(p.dancer_details.partner_years_min).toBe(2);
    expect(p.dancer_details.partner_years_max).toBe(5);
  });
  it('Any sends nulls', () => {
    const p: any = buildDashboardSectionPayload('partner', { ...form, partner_years_min: null, partner_years_max: null }, { levelRetired: true });
    expect(p.dancer_details.partner_years_min).toBeNull();
  });
  it('save builder drops the level when retired and keeps years', () => {
    const input = { dancer_details: { partner_search_level: ['Pro'], partner_years_min: 5, partner_years_max: null } };
    expect(buildDancerProfilePayload(input, true).dancer_details).toEqual({ partner_years_min: 5, partner_years_max: null });
    expect((buildDancerProfilePayload(input, false) as any).dancer_details.partner_search_level).toEqual(['Pro']);
  });
  it('wizard: no level, no experience-level start year when retired', () => {
    const v = { experience_level: 'Beginner', partner_search_level: ['Pro'] };
    const ctx = { firstName: 'a', surname: 'b', cityId: 'c', currentYear: 2026 };
    const on: any = buildCreateProfilePayload(v, { ...ctx, levelRetired: true });
    expect(on.dancer_details.partner_search_level).toBeUndefined();
    expect(on.dancer_details.dance_started_year).toBeNull();
    expect((buildCreateProfilePayload(v, { ...ctx, levelRetired: false }) as any).dancer_details.partner_search_level).toEqual(['Pro']);
  });
});
