// @vitest-environment jsdom
/** Keep-list for DancerProfileGrid + ExperiencePicker, level-retired flag ON and OFF. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DancerPublicViewModel } from '@/modules/profile/dancerPublicProfile';

const f = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/levelRetiredFlag', () => ({
  get LEVEL_RETIRED_ENABLED() {
    return f.on;
  },
}));
vi.mock('@/components/profile/ProfileEventTimeline', () => ({ default: () => null }));
vi.mock('@/lib/embeddedProfile', () => ({ useEmbeddedProfile: () => false }));

import { DancerProfileGrid } from '../DancerProfileGrid';
import { ExperiencePicker } from '../ExperiencePicker';

const dancer = (o: Partial<DancerPublicViewModel> = {}): DancerPublicViewModel => ({
  id: 'd1', displayName: 'Test Dancer', avatarUrl: null, city: 'Bristol', nationality: null,
  nationalityCode: null, yearsDancing: '5', dancingStartDate: null, favoriteStyles: [],
  partnerRole: 'Leader', lookingForPartner: true, achievements: [], favoriteSongs: [],
  partnerSearchRole: 'Follower', partnerSearchLevel: ['Advanced'], partnerYearsMin: 2,
  partnerYearsMax: 5, partnerPracticeGoals: ['Socials'], partnerDetailsText: 'Note',
  isVerified: false, goals: [],
  connectLinks: { instagram: null, facebook: null, website: null, email: null }, ...o,
});
const mount = (d: DancerPublicViewModel) =>
  render(<MemoryRouter><DancerProfileGrid dancer={d} /></MemoryRouter>);

afterEach(cleanup);

describe('DancerProfileGrid keep-list', () => {
  const kept = () => {
    expect(screen.getByText('Leader')).toBeTruthy();
    expect(screen.getByText('Follower')).toBeTruthy();
    expect(screen.getByText('Socials')).toBeTruthy();
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.getByText('Experience')).toBeTruthy();
    expect(screen.getByText('Vibes with:')).toBeTruthy();
  };
  it('flag off: today unchanged (level badge, level chips)', () => {
    f.on = false;
    mount(dancer());
    kept();
    expect(screen.getByText('Experienced')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
    expect(screen.queryByText('2-5 years')).toBeNull();
  });
  it('flag on: no level badge, years range + "N years dancing"', () => {
    f.on = true;
    mount(dancer());
    kept();
    expect(screen.queryByText('Experienced')).toBeNull();
    expect(screen.queryByText('Advanced')).toBeNull();
    expect(screen.getByText('2-5 years')).toBeTruthy();
    expect(screen.getAllByText('5 years dancing').length).toBeGreaterThan(0);
  });
  it('flag on: singular, under 1 year, level alone is not partner intent', () => {
    f.on = true;
    mount(dancer({ yearsDancing: '1' }));
    expect(screen.getAllByText('1 year dancing').length).toBeGreaterThan(0);
    cleanup();
    mount(dancer({ yearsDancing: '0' }));
    expect(screen.getAllByText('Under 1 year dancing').length).toBeGreaterThan(0);
    cleanup();
    mount(dancer({ lookingForPartner: false, partnerSearchRole: null, partnerPracticeGoals: [],
      partnerDetailsText: '', partnerYearsMin: null, partnerYearsMax: null }));
    expect(screen.queryByText('Vibes with:')).toBeNull();
  });
});

describe('ExperiencePicker keep-list', () => {
  const start = `${new Date().getFullYear() - 3}-01-01`;
  it('flag off: title shown', () => {
    f.on = false;
    render(<ExperiencePicker value={start} onChange={() => {}} showLabel />);
    expect(screen.getByText('Experienced')).toBeTruthy();
    expect(screen.getByText('How long have you been dancing?')).toBeTruthy();
  });
  it('flag on: no title, duration and date pickers stay', () => {
    f.on = true;
    render(<ExperiencePicker value={start} onChange={() => {}} showLabel />);
    expect(screen.queryByText('Experienced')).toBeNull();
    expect(screen.getByText('How long have you been dancing?')).toBeTruthy();
    expect(screen.getByText(/3 Years/)).toBeTruthy();
    expect(screen.getAllByRole('combobox').length).toBe(2);
  });
});
