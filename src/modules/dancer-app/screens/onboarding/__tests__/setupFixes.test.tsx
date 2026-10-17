// @vitest-environment jsdom
/**
 * Audit fixes on the setup cards (A3): M5 consent line, L16 "Not you?" link, M8 "You're in" copy,
 * M23 load error, M24 no false RSVP claim, M9 one photo button, M2 Enter submits, M28 city not listed,
 * L17 role error names the chips. Prod-shape seeds: empty stub, half-finished, long name, broken photo URL.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...(await importOriginal<object>()), trackAnalyticsEvent: vi.fn() }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange('c1000000-0000-4000-8000-000000000001')}>London</button>
  ),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { CITY_LONDON, makeProfile } from '@/modules/dancer-app/api/fixtures';
import { copyFor } from '@/modules/dancer-app/api/errors';
import { DancerApiError } from '@/modules/dancer-app/api/errors';
import { ROLE_CHOICES } from '@/modules/dancer-app/api/nextStep';
import { ADD_CITY_MESSAGE, NOT_ME_MESSAGE, dancerMessageUsUrl } from '@/modules/dancer-app/api/messageUs';

afterEach(() => {
  cleanup();
  resetShell();
});

const LONG_FIRST = 'Maximiliana-Esperanza-Guadal'; // 29 chars
const FOUR = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: 'https://img.example/a.jpg' };
const open = (profile = makeProfile()) => renderInShell({ path: '/app/welcome', backend: { profile } });

describe('M5: no plain-text consent line on the first card (consent is recorded at sign-up)', () => {
  it.each([
    ['empty stub', makeProfile()],
    ['half-finished', makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id })],
  ])('%s', async (_n, profile) => {
    open(profile);
    await screen.findByTestId('onboarding-first-notes').catch(() => null);
    await waitFor(() => expect(screen.queryByTestId('onboarding-skeleton')).toBeNull());
    expect(screen.queryByTestId('onboarding-consent')).toBeNull();
    expect(screen.queryByText(/Terms and Privacy/)).toBeNull();
  });
});

describe('L16: "Not you? Message us" is dancer-specific and has its href on first render', () => {
  it('linked profile', async () => {
    open(makeProfile({ first_name: 'Ana', linked_from_admin: true }));
    const notice = await screen.findByTestId('onboarding-linked-notice');
    const a = notice.querySelector('a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(dancerMessageUsUrl(NOT_ME_MESSAGE));
    expect(a.getAttribute('href')).not.toMatch(/list%20my%20events/);
  });
});

describe('M8 + M24: the "You\u2019re in" card', () => {
  it.each([
    ['four-field complete, both optional left', makeProfile(FOUR), 'Two quick questions'],
    ['long name, one optional left', makeProfile({ ...FOUR, first_name: LONG_FIRST, dance_started_year: 2020 }), 'One quick question'],
  ])('%s', async (_n, profile, button) => {
    open(profile);
    const card = await screen.findByTestId('onboarding-in-card');
    const pctShown = screen.getByTestId('onboarding-pct').textContent;
    expect(card.textContent).toContain(`${pctShown} \u00b7 Your profile is live`);
    expect(card.textContent).not.toMatch(/past the line|Boost|100%/);
    expect(card.textContent).not.toMatch(/Going and Interested|unlock/i);
    expect(screen.getByTestId('onboarding-boost').textContent).toBe(button);
  });

  it('a hidden profile is not called live', async () => {
    open(makeProfile({ ...FOUR, is_active: false }));
    const card = await screen.findByTestId('onboarding-in-card');
    expect(card.textContent).not.toMatch(/is live/);
    expect(card.textContent).toMatch(/hidden/);
  });
});

describe('M24: Me makes no "unlock at 70%" claim (the RSVP RPC has no profile rule)', () => {
  it.each([
    ['empty stub', makeProfile()],
    ['broken photo URL, no role', makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, avatar_url: 'https://img.example/missing-404.jpg' })],
  ])('%s', async (_n, profile) => {
    renderInShell({ path: '/app/me', backend: { profile } });
    await screen.findByTestId('dancer-screen-me');
    expect(screen.queryByTestId('me-unlock-note')).toBeNull();
    expect(screen.queryByText(/unlock/i)).toBeNull();
  });
});

describe('M23: the setup load error has Try again and a way back', () => {
  it('Try again refetches and shows the card', async () => {
    const backend = createFakeBackend({ profile: makeProfile() });
    const real = backend.fetchMyDancerEdit.bind(backend);
    let n = 0;
    backend.fetchMyDancerEdit = () => (n++ === 0 ? Promise.reject(new DancerApiError('unknown', 'boom')) : real());
    renderInShell({ path: '/app/welcome', backend });
    const err = await screen.findByTestId('onboarding-load-error');
    expect(err.querySelector('a[href="/"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('onboarding-name');
  });

  it('no dancer profile: says so and links to a message, not a dead end', async () => {
    renderInShell({ path: '/app/welcome', backend: { profile: null } });
    const err = await screen.findByTestId('onboarding-load-error');
    expect(err.textContent).toContain(copyFor('no_profile'));
    expect(err.querySelector('a[href^="https://wa.me/"]')).toBeTruthy();
  });
});

describe('M9: the setup photo card has ONE button', () => {
  it('Add my photo, to the photo screen', async () => {
    open(makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Leader' }));
    await screen.findByTestId('onboarding-photo');
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/app/me/photo'));
    expect(links.map((a) => a.textContent)).toEqual(['Add my photo']);
  });
});

describe('M2: the name card submits on Enter', () => {
  it('enterKeyHint next on both fields; Enter saves the name', async () => {
    const { backend } = open();
    await screen.findByTestId('onboarding-name');
    const first = screen.getByLabelText('First name');
    expect(first.getAttribute('enterkeyhint')).toBe('next');
    expect(screen.getByLabelText(/Name shown on your page/).getAttribute('enterkeyhint')).toBe('next');
    fireEvent.change(first, { target: { value: LONG_FIRST } });
    fireEvent.keyDown(first, { key: 'Enter' });
    await screen.findByTestId('onboarding-city');
    expect(backend.calls.some((c) => c.fn === 'saveMyDancerProfile')).toBe(true);
  });

  it('Enter with an empty name sends nothing', async () => {
    const { backend } = open();
    await screen.findByTestId('onboarding-name');
    fireEvent.keyDown(screen.getByLabelText('First name'), { key: 'Enter' });
    expect(backend.calls.some((c) => c.fn === 'saveMyDancerProfile')).toBe(false);
  });
});

describe('M28: a city not in the list has a way on', () => {
  it('Message us to add your city', async () => {
    open(makeProfile({ first_name: 'Ana' }));
    await screen.findByTestId('onboarding-city');
    const link = await screen.findByRole('link', { name: /Message us to add your city/ });
    expect(link.getAttribute('href')).toBe(dancerMessageUsUrl(ADD_CITY_MESSAGE));
  });
});

describe('L17: the invalid-role error names the chips the person sees', () => {
  it('copy', () => {
    const labels = ROLE_CHOICES.map((c) => c.label);
    expect(copyFor('invalid_role')).toBe(`Pick ${labels[0]}, ${labels[1]} or ${labels[2]}.`);
  });
});
