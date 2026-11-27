// @vitest-environment jsdom
/** Dancer onboarding v3 slice 3: the bio + links screen, in sequence and from Home (?step=bio). */
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
import { linkTarget } from '../bioModel';

afterEach(async () => {
  // The neon burst fires on a 120ms timer that outlives the screen: let it land before the next test.
  await new Promise((r) => setTimeout(r, 150));
  cleanup();
  resetShell();
  vi.mocked(boom).mockClear();
});

const DONE = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'follower', avatar_url: 'https://x.test/a.jpg', buyer_roles: ['dancer'], favorite_styles: ['Sensual'], dance_started_year: 2020, looking_for_partner: false } as Partial<MyDancerEdit>;
const fromHome = (over: Partial<MyDancerEdit> = {}) => renderInShell({ path: '/app/welcome?step=bio&returnTo=/app/home', backend: { shape: 'emptyStub', profile: makeProfile({ ...DONE, ...over }) } });
const saves = (b: FakeDancerBackend) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile').map((c) => c.args);
const bioBox = () => screen.getByTestId('onboarding-bio-input') as HTMLTextAreaElement;
const linkBox = () => screen.getByTestId('onboarding-link-input') as HTMLInputElement;

describe('linkTarget', () => {
  it.each([
    ['', null], ['@ana', 'instagram'], ['ana.dance', 'instagram'], ['instagram.com/ana', 'instagram'], ['https://www.instagram.com/ana/', 'instagram'],
    ['https://ana.com', 'website_url'], ['www.ana.com', 'website_url'], ['ana.co.uk', 'website_url'], ['ana_dj', 'instagram'],
  ])('%s -> %s', (raw, want) => expect(linkTarget(raw)).toBe(want));
});

describe('bio screen from Home (?step=bio)', () => {
  it('keep-list: heading, sub, 3-row bio, link box, Finish, Skip for now, Back; no progress, no design note', async () => {
    fromHome();
    await screen.findByTestId('onboarding-bio-input');
    expect(screen.getByRole('heading').textContent).toBe('Tell us about you');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Add a bio and a link so dancers know you. You can change this any time on Me.');
    expect(bioBox().getAttribute('placeholder')).toBe('A short bio');
    expect(bioBox().rows).toBe(4);
    expect(linkBox().getAttribute('placeholder')).toBe('Instagram or other link');
    expect(screen.getByTestId('onboarding-finish').textContent).toBe('Save');
    expect(screen.getByTestId('onboarding-skip').textContent).toBe('Not now');
    // Neon frame: the 6-segment bar shows; there is no Back on this single-screen entry.
    expect(screen.getAllByTestId('onboarding-seg').length).toBe(6);
    expect(document.body.textContent).not.toMatch(/real Home, exactly as today/);
  });

  it('Finish with both empty sends nothing, no confetti, goes Home', async () => {
    const { backend } = fromHome();
    await screen.findByTestId('onboarding-bio-input');
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    await waitFor(() => expect(screen.queryByTestId('onboarding-bio-input')).toBeNull());
    expect(saves(backend)).toHaveLength(0);
    expect(boom).not.toHaveBeenCalled();
  });

  it('Finish with a bio and an instagram link saves only those keys, celebrates, goes Home', async () => {
    const { backend } = fromHome();
    await screen.findByTestId('onboarding-bio-input');
    fireEvent.change(bioBox(), { target: { value: 'Sensual dancer from Leeds' } });
    fireEvent.change(linkBox(), { target: { value: '@ana.dance' } });
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    await waitFor(() => expect(saves(backend)).toHaveLength(1));
    expect(saves(backend)[0]).toEqual({ bio: 'Sensual dancer from Leeds', instagram: 'ana.dance' });
    await waitFor(() => expect(boom).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('onboarding-bio-input')).toBeNull());
  });

  it('another link goes to website_url', async () => {
    const { backend } = fromHome();
    await screen.findByTestId('onboarding-bio-input');
    fireEvent.change(linkBox(), { target: { value: 'ana.com' } });
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    await waitFor(() => expect(saves(backend)).toHaveLength(1));
    expect(saves(backend)[0]).toEqual({ website_url: 'https://ana.com' });
  });

  it('a refused Instagram shows the Edit copy under the field and saves nothing', async () => {
    const { backend } = fromHome();
    await screen.findByTestId('onboarding-bio-input');
    fireEvent.change(linkBox(), { target: { value: 'ana!!' } });
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    expect((await screen.findByTestId('onboarding-error')).textContent).toMatch(/letters, numbers, dots and underscores/i);
    expect(saves(backend)).toHaveLength(0);
    expect(boom).not.toHaveBeenCalled();
  });

  it('Skip for now and Back save nothing and leave without confetti', async () => {
    const a = fromHome();
    await screen.findByTestId('onboarding-bio-input');
    fireEvent.change(bioBox(), { target: { value: 'typed but skipped' } });
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    await waitFor(() => expect(screen.queryByTestId('onboarding-bio-input')).toBeNull());
    expect(saves(a.backend)).toHaveLength(0);
    cleanup(); resetShell();
    const b = fromHome();
    await screen.findByTestId('onboarding-bio-input');
    fireEvent.click(screen.getByTestId('onboarding-back'));
    await waitFor(() => expect(screen.queryByTestId('onboarding-bio-input')).toBeNull());
    expect(saves(b.backend)).toHaveLength(0);
    expect(boom).not.toHaveBeenCalled();
  });
});

describe('bio screen in the onboarding sequence', () => {
  it('follows photo; Back returns to photo; Finish saves and ends', async () => {
    window.sessionStorage.setItem('da-onboarding-v3-photo', '1');
    const r = renderInShell({ path: '/app/welcome', backend: { shape: 'emptyStub', profile: makeProfile({ ...DONE }) } });
    await screen.findByTestId('onboarding-photo');
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    await screen.findByTestId('onboarding-bio-input');
    expect(screen.getAllByTestId('onboarding-seg').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('onboarding-back'));
    await screen.findByTestId('onboarding-photo');
    fireEvent.click(screen.getByTestId('onboarding-continue'));
    fireEvent.change(await screen.findByTestId('onboarding-bio-input'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    await waitFor(() => expect(saves(r.backend)).toEqual([{ bio: 'hello' }]));
    await waitFor(() => expect(boom).toHaveBeenCalled());
  });
});

describe('link box prefill (owner 2026-11-24: a saved link must show, Finish must not overwrite it)', () => {
  it('shows the saved Instagram, and Finish on an untouched box sends nothing for the link', async () => {
    const { backend } = fromHome({ instagram: 'ana_dances' });
    await screen.findByTestId('onboarding-bio-input');
    expect(linkBox().value).toBe('ana_dances');
    fireEvent.change(bioBox(), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    await waitFor(() => expect(saves(backend)).toHaveLength(1));
    expect(saves(backend)[0]).toEqual(expect.not.objectContaining({ instagram: expect.anything() }));
  });

  it('shows the saved website when there is no Instagram', async () => {
    fromHome({ instagram: null, website_url: 'https://ana.com' });
    await screen.findByTestId('onboarding-bio-input');
    expect(linkBox().value).toBe('https://ana.com');
  });

  it('an empty profile still shows an empty box', async () => {
    fromHome({ instagram: null, website_url: null });
    await screen.findByTestId('onboarding-bio-input');
    expect(linkBox().value).toBe('');
  });
});
