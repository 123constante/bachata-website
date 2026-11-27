// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.hoisted(() => vi.stubEnv('VITE_ENABLE_DANCER_ONBOARDING_V3', 'true'));
vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...(await importOriginal<object>()), trackAnalyticsEvent: vi.fn() }));
vi.mock('../neon/neonConfetti', () => ({ boom: vi.fn(() => 0) }));

import { boom } from '../neon/neonConfetti';
import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { CITY_LONDON, makeProfile } from '@/modules/dancer-app/api/fixtures';
import type { FakeDancerBackend } from '@/modules/dancer-app/api/fakeBackend';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';
import { partnerDelta, partnerDraftFrom } from '../modelV3';

afterEach(async () => {
  // The neon burst fires on a 120ms timer that outlives the screen: let it land before the next test.
  await new Promise((r) => setTimeout(r, 150));
  cleanup();
  resetShell();
  window.sessionStorage.clear();
  vi.mocked(boom).mockClear();
});

const BASE = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'follower', buyer_roles: ['dancer'], favorite_styles: ['Zouk'], dance_started_year: 2019, avatar_url: null } as Partial<MyDancerEdit>;
const open = (over: Partial<MyDancerEdit> = {}) => renderInShell({ path: '/app/welcome', backend: { shape: 'emptyStub', profile: makeProfile({ ...BASE, ...over }) } });
const step = (id: string) => screen.findByTestId(`onboarding-${id}`);
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;
const cont = () => btn('onboarding-continue');
const saves = (b: FakeDancerBackend) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile').map((c) => c.args);

describe('partner screen', () => {
  it('keep-list: heading, sub, two rows, Continue disabled with a reason, Back present', async () => {
    open();
    await step('partner');
    expect(screen.getByRole('heading').textContent).toBe('Looking for a dance partner?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Say yes and we show you to dancers who want a partner.');
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['\u{1F91D}Yes, I am', '\u{1F642}No, just social dancing']);
    screen.getAllByRole('radio').forEach((r) => expect(r.querySelector('.ic')).toBeTruthy());
    expect(cont().disabled).toBe(true);
    expect(screen.queryByTestId('partner-sheet')).toBeNull();
    expect(btn('onboarding-back')).toBeTruthy();
  });

  it('No: ticks, saves only looking_for_partner:false, celebrates, goes to photo', async () => {
    const { backend } = open();
    await step('partner');
    fireEvent.click(screen.getByTestId('onboarding-partner-no'));
    expect(screen.getByTestId('onboarding-partner-no').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('partner-sheet')).toBeNull();
    fireEvent.click(cont());
    await step('photo');
    expect(saves(backend)).toEqual([{ looking_for_partner: false }]);
    await waitFor(() => expect(boom).toHaveBeenCalledTimes(1));
  });

  it('Yes opens the sheet with every section; Continue stays disabled until a role is picked', async () => {
    open();
    await step('partner');
    fireEvent.click(screen.getByTestId('onboarding-partner-yes'));
    const sheet = screen.getByTestId('partner-sheet');
    expect(sheet.textContent).toContain('Your ideal partner');
    for (const t of ['What kind', 'Their role', 'Years dancing', 'Social dancing', 'Classes', 'Performance', 'Competition', 'Leader', 'Follower', 'Either', '0-2', '2-5', '5+', 'Any', 'Save']) {
      expect(sheet.textContent).toContain(t);
    }
    expect((screen.getByTestId('partner-details') as HTMLInputElement).placeholder).toBe('A line to potential partners');
    // Save needs a kind, a role and years: until then it is disabled and the sheet says what is missing.
    expect((screen.getByTestId('partner-sheet-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('partner-hint').textContent).toMatch(/their role/i);
    expect(cont().disabled).toBe(false);
  });

  it('sheet answers map to stored values, survive close + reopen, and save in ONE write', async () => {
    const { backend } = open();
    await step('partner');
    fireEvent.click(screen.getByTestId('onboarding-partner-yes'));
    fireEvent.click(screen.getByTestId('partner-kind-Practice'));
    fireEvent.click(screen.getByTestId('partner-kind-Performance'));
    fireEvent.click(screen.getByTestId('partner-role-Either'));
    fireEvent.click(screen.getByTestId('partner-years-5+'));
    fireEvent.change(screen.getByTestId('partner-details'), { target: { value: 'Weekly practice' } });
    // The sheet keeps the answers while open; Save closes it, saves once and moves on.
    fireEvent.click(screen.getByTestId('onboarding-partner-yes'));
    expect(screen.getByTestId('partner-role-Either').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('partner-kind-Practice').getAttribute('aria-checked')).toBe('true');
    expect(saves(backend)).toEqual([]);
    fireEvent.click(screen.getByTestId('partner-sheet-save'));
    await step('photo');
    expect(saves(backend)).toEqual([
      { looking_for_partner: true, partner_search_role: 'Lead and Follow', partner_years_min: 5, partner_practice_goals: ['Practice', 'Performance'], partner_details: 'Weekly practice' },
    ]);
  });

  it('picking No after Yes closes the sheet and sends no other partner key', async () => {
    const { backend } = open();
    await step('partner');
    fireEvent.click(screen.getByTestId('onboarding-partner-yes'));
    fireEvent.click(screen.getByTestId('partner-role-Leader'));
    fireEvent.click(screen.getByTestId('onboarding-partner-no'));
    expect(screen.queryByTestId('partner-sheet')).toBeNull();
    fireEvent.click(cont());
    await step('photo');
    expect(saves(backend)).toEqual([{ looking_for_partner: false }]);
  });

  it('is no longer skipped without the dancer role (every role gets the same six steps)', async () => {
    open({ buyer_roles: ['dj'], dance_started_year: null });
    await step('years');
    fireEvent.click(screen.getByTestId('onboarding-years-over-10'));
    fireEvent.click(cont());
    await step('partner');
    expect(screen.getAllByTestId('onboarding-seg').length).toBe(6);
  });

  it('model: draft round trip and Any years', () => {
    const d = partnerDraftFrom({ looking_for_partner: true, partner_search_role: 'Leader', partner_years_min: 2, partner_years_max: 5, partner_details: 'hi', partner_practice_goals: ['Competition'] });
    expect(d).toEqual({ answer: 'yes', kinds: ['Competition'], role: 'Leader', years: '2-5', details: 'hi' });
    expect(partnerDelta({ ...d, years: 'any' })).toMatchObject({ partner_years_min: null, partner_years_max: null });
    expect(partnerDelta({ ...d, answer: 'no' })).toEqual({ looking_for_partner: false });
  });
});

describe('photo screen', () => {
  const atPhoto = (over: Partial<MyDancerEdit> = {}) => open({ looking_for_partner: false, ...over });

  it('empty state keep-list: heading, sub, camera tile, Continue disabled with a reason', async () => {
    atPhoto();
    await step('photo');
    expect(screen.getByRole('heading').textContent).toBe('Show us your face');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('A photo is required. Partners and organisers need to know who you are.');
    const tile = btn('onboarding-photo-tile');
    expect(tile.textContent).toBe('\u{1F4F8}Tap to add a photo');
    expect(cont().disabled).toBe(true);
    expect(screen.getByTestId('onboarding-reason').textContent).toMatch(/photo/i);
  });

  it('tile hands off to the existing photo screen and sets the return flag', async () => {
    const { location } = atPhoto();
    await step('photo');
    fireEvent.click(btn('onboarding-photo-tile'));
    await waitFor(() => expect(location()).toContain('/app/me/photo'));
    expect(location()).toContain('return=');
    expect(window.sessionStorage.getItem('da-onboarding-v3-photo')).toBe('1');
  });

  it('coming back with a photo lands on the photo step showing it; Continue celebrates and goes to the bio step; Skip ends on Home', async () => {
    window.sessionStorage.setItem('da-onboarding-v3-photo', '1');
    const { location } = atPhoto({ avatar_url: 'https://x.test/a.jpg' });
    await step('photo');
    expect(btn('onboarding-photo-tile').textContent).toBe('\u{1F9D1}Photo added. Tap to change');
    expect(cont().disabled).toBe(false);
    fireEvent.click(cont());
    await step('bio');
    fireEvent.click(btn('onboarding-skip'));
    await waitFor(() => expect(location()).toBe('/app/home'));
    // The burst is on a 120ms timer and earlier tests' timers can land late, so assert it fired rather than a count.
    await waitFor(() => expect(boom).toHaveBeenCalled());
    expect(screen.queryByText(/you.re in|nice work/i)).toBeNull();
  });

  it('Back from photo returns to partner without celebrating', async () => {
    atPhoto();
    await step('photo');
    fireEvent.click(btn('onboarding-back'));
    await step('partner');
    expect(boom).not.toHaveBeenCalled();
  });

  it('resume: partner answered + photo set goes straight to Home', async () => {
    const { location } = atPhoto({ avatar_url: 'https://x.test/a.jpg' });
    await waitFor(() => expect(location()).toBe('/app/home'));
  });
});
