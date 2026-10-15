// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...(await importOriginal<object>()), trackAnalyticsEvent: vi.fn() }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <div>
      <button type="button" onClick={() => onChange('c1000000-0000-4000-8000-000000000001')}>London</button>
      <button type="button" onClick={() => onChange('c1000000-0000-4000-8000-000000000002')}>Madrid</button>
    </div>
  ),
}));

import { trackAnalyticsEvent } from '@/lib/analytics';
import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { CITY_LONDON, DANCER_SHAPES, makeProfile, type DancerShapeName } from '@/modules/dancer-app/api/fixtures';
import { DANCER_ERROR_CODES, type DancerErrorCode } from '@/modules/dancer-app/api/types';
import { copyFor } from '@/modules/dancer-app/api/errors';
import type { FakeDancerBackend } from '@/modules/dancer-app/api/fakeBackend';

afterEach(() => {
  cleanup();
  resetShell();
  vi.mocked(trackAnalyticsEvent).mockClear();
});

const stage = (id: string) => screen.findByTestId(`onboarding-${id}`);
// Async: the city picker, the optional cards and the first-card notes are lazy chunks.
const click = async (name: string) => {
  const node = (await screen.findAllByText(name)).map((n) => n.closest('button')).find(Boolean);
  fireEvent.click(node as HTMLElement);
};
const last = <T,>(a: T[]): T => a[a.length - 1];
const pct = () => screen.getByTestId('onboarding-pct').textContent;
const saves = (b: FakeDancerBackend) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile').map((c) => c.args);
const open = (shape: DancerShapeName, over: Record<string, unknown> = {}) => renderInShell({ path: '/app/welcome', backend: { shape, ...over } });

const START: Array<[DancerShapeName, string]> = [
  ['emptyStub', 'name'],
  ['nameCityOnly', 'role'],
  ['adminUnclaimedPhotoless', 'photo'],
  ['claimedIncompleteAdmin', 'role'],
  ['fourFieldComplete', 'in'],
  ['adminSurnameInDisplayName', 'in'],
];

describe('which card starts (the server decides)', () => {
  it.each(START)('%s starts at %s, with the server pct on the meter', async (shape, expected) => {
    open(shape);
    await stage(expected);
    expect(pct()).toBe(`${DANCER_SHAPES[shape].profile!.strength.pct}%`);
  });

  it('a complete profile with extras has no onboarding: redirect to Home', async () => {
    const { location } = open('completeAllExtras');
    await waitFor(() => expect(location()).toBe('/app/home'));
  });

  it('shows a skeleton, no card, until the server shape is known', async () => {
    const backend = createFakeBackend({ shape: 'emptyStub' });
    backend.fetchMyDancerEdit = () => new Promise(() => {});
    renderInShell({ path: '/app/welcome', backend });
    expect(await screen.findByTestId('onboarding-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-name')).toBeNull();
  });
});

describe('disabled with a visible reason', () => {
  it('name, city and role cards', async () => {
    open('emptyStub');
    await stage('name');
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('onboarding-reason').textContent).toMatch(/first name/i);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ana' } });
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(false);
  });

  it('city card needs a city; role card needs a role', async () => {
    open('emptyStub', { profile: makeProfile({ first_name: 'Ana' }) });
    await stage('city');
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('onboarding-reason').textContent).toMatch(/city/i);
    await click('London');
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    open('nameCityOnly');
    await stage('role');
    expect((screen.getByTestId('onboarding-continue') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('onboarding-reason').textContent).toMatch(/Leader, Follower or Both/);
  });

  it('the photo card cannot be skipped: no Continue, no Skip, only the hand-off', async () => {
    open('adminUnclaimedPhotoless');
    await stage('photo');
    expect(screen.queryByRole('button', { name: /continue|skip/i })).toBeNull();
    const hrefs = [screen.getByTestId('onboarding-take-photo'), screen.getByTestId('onboarding-choose-photo')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/app/me/photo?return=/app/welcome', '/app/me/photo?return=/app/welcome']);
    expect(screen.getByTestId('onboarding-reason').textContent).toMatch(/cannot be skipped/);
  });
});

describe('the whole walk: exact keys per step, meter from the server', () => {
  it('empty stub -> name -> city -> role -> photo hand-off -> You are in -> years -> styles -> Nice work', async () => {
    const { backend } = open('emptyStub');
    await stage('name');
    expect(pct()).toBe('10%');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '  Ana ' } });
    await click('Continue');
    await stage('city');
    expect(pct()).toBe('25%');
    await click('London');
    await click('Continue');
    await stage('role');
    expect(pct()).toBe('40%');
    await click('Both');
    await click('Continue');
    await stage('photo');
    expect(pct()).toBe('55%');
    expect(saves(backend)).toEqual([
      { first_name: 'Ana' },
      { based_city_id: 'c1000000-0000-4000-8000-000000000001' },
      { dance_role: 'Lead and Follow' },
    ]);
    // Photo comes back saved (the photo screen's own save), then the page is re-opened.
    await backend.saveMyDancerProfile({ avatar_url: 'https://img.example/a.jpg' });
    cleanup();
    renderInShell({ path: '/app/welcome', backend });
    await stage('in');
    expect(pct()).toBe('70%');
    expect(screen.getByTestId('onboarding-in-card').textContent).toContain('You\u2019re in, Ana');
    expect(screen.getByTestId('onboarding-in-card').textContent).toContain('Your page is live and Going and Interested are unlocked.');
    await click('Boost to 100%');
    await stage('years');
    await click('1 to 2 years');
    await click('Continue');
    await stage('styles');
    expect(pct()).toBe('80%');
    expect(last(saves(backend))).toEqual({ dance_started_year: new Date().getFullYear() - 1 });
    await click('Bachata Sensual');
    await click('Continue');
    await stage('nice');
    expect(pct()).toBe('90%');
    expect(last(saves(backend))).toEqual({ favorite_styles: ['Bachata Sensual'] });
    expect(screen.getByTestId('onboarding-nice-card').textContent).toContain('Nice work, Ana');
  });

  it('name card: a display name rides along only when typed', async () => {
    const { backend } = open('emptyStub');
    await stage('name');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/Name shown on your page/), { target: { value: 'Ana L' } });
    await click('Continue');
    await stage('city');
    expect(saves(backend)).toEqual([{ first_name: 'Ana', display_name: 'Ana L' }]);
  });

  it('Skip sends nothing, and moves on', async () => {
    const { backend } = open('fourFieldComplete');
    await stage('in');
    await click('Boost to 100%');
    await stage('years');
    await click('Skip');
    await stage('styles');
    await click('Skip');
    await stage('nice');
    expect(saves(backend)).toEqual([]);
    expect(backend.writes).toBe(0);
  });

  it('resume: reopening recomputes the first missing step from the server', async () => {
    const { backend } = open('emptyStub');
    await stage('name');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ana' } });
    await click('Continue');
    await stage('city');
    cleanup();
    renderInShell({ path: '/app/welcome', backend });
    await stage('city');
    expect(screen.queryByLabelText('First name')).toBeNull();
  });
});

describe('server pct wins; funnel events', () => {
  it('shows the pct the server returned, never a client number', async () => {
    const backend = createFakeBackend({ shape: 'emptyStub', profile: { ...DANCER_SHAPES.nameCityOnly.profile!, strength: { pct: 41, next_step: 'role', missing: ['role', 'photo', 'started_year', 'styles', 'bio_social'] } } });
    const save = backend.saveMyDancerProfile;
    backend.saveMyDancerProfile = async (d) => {
      const next = await save(d);
      return { ...next, strength: { ...next.strength, pct: 43 } };
    };
    renderInShell({ path: '/app/welcome', backend });
    await stage('role');
    expect(pct()).toBe('41%');
    await click('Leader');
    await click('Continue');
    await stage('photo');
    expect(pct()).toBe('43%');
  });

  it('the You are in card shows the server pct (73), not a client 70', async () => {
    const p = DANCER_SHAPES.fourFieldComplete.profile!;
    open('fourFieldComplete', { profile: { ...p, strength: { ...p.strength, pct: 73 } } });
    await stage('in');
    expect(pct()).toBe('73%');
    expect(screen.getByTestId('onboarding-in-card').textContent).toContain('73% \u00b7 you\u2019re past the line');
  });

  it('onboarding_step fires per card; profile_strength_70 once, with the server pct', async () => {
    const { backend } = open('adminUnclaimedPhotoless');
    await stage('photo');
    await backend.saveMyDancerProfile({ avatar_url: 'https://img.example/a.jpg' });
    expect(vi.mocked(trackAnalyticsEvent).mock.calls.filter((c) => c[0] === 'onboarding_step').map((c) => c[1])).toEqual([{ step: 'photo' }]);
    expect(vi.mocked(trackAnalyticsEvent).mock.calls.filter((c) => c[0] === 'profile_strength_70')).toEqual([]);
  });

  it('fires profile_strength_70 when a save takes the server across 70, once', async () => {
    open('emptyStub', { profile: makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, avatar_url: 'https://img.example/a.jpg' }) });
    await stage('role');
    await click('Leader');
    await click('Continue');
    await stage('in');
    const hits = vi.mocked(trackAnalyticsEvent).mock.calls.filter((c) => c[0] === 'profile_strength_70');
    expect(hits).toEqual([['profile_strength_70', { pct: 70 }]]);
  });
});

describe('errors use the one copy map', () => {
  const CODES: DancerErrorCode[] = ['first_name_required', 'city_required', 'invalid_display_name', 'area_closed', 'rate_limited', 'unknown'];
  it.each(CODES)('%s shows its copy and keeps the person on the card', async (code) => {
    expect(DANCER_ERROR_CODES).toContain(code);
    const { backend } = open('emptyStub');
    await stage('name');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ana' } });
    backend.failNextWith(code);
    await click('Continue');
    expect((await screen.findByTestId('onboarding-error')).textContent).toBe(copyFor(code));
    expect(screen.getByTestId('onboarding-name')).toBeTruthy();
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Ana');
  });
});

describe('first-card notes', () => {
  it('consent line on the first card only; linked notice only for a linked profile', async () => {
    open('claimedIncompleteAdmin');
    await stage('role');
    expect((await screen.findByTestId('onboarding-consent')).textContent).toBe('By continuing you accept the Terms and Privacy policy.');
    // No Terms/Privacy page exists on the site yet, so the line carries no dead links.
    expect((await screen.findByTestId('onboarding-consent')).querySelectorAll('a')).toHaveLength(0);
    expect((await screen.findByTestId('onboarding-linked-notice')).textContent).toContain('We linked your existing profile. Not you?');
    await click('Leader');
    await click('Continue');
    await stage('photo');
    expect(screen.queryByTestId('onboarding-consent')).toBeNull();
    cleanup();
    open('emptyStub');
    await stage('name');
    expect(await screen.findByTestId('onboarding-consent')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-linked-notice')).toBeNull();
  });
});

describe('copy and sizes', () => {
  it('never says "Save"; long names wrap; every control is at least 44px', async () => {
    const long = 'Maximiliano-Bartholomew '.repeat(5).trim();
    open('fourFieldComplete', { profile: makeProfile({ ...DANCER_SHAPES.fourFieldComplete.profile, first_name: long }) });
    const card = await stage('in');
    expect(card.textContent).not.toMatch(/\bsave/i);
    expect(card.style.overflowWrap).toBe('anywhere');
    for (const el of [...card.querySelectorAll<HTMLElement>('button, a')]) {
      expect(parseInt(el.style.minHeight || '0', 10), el.textContent ?? '').toBeGreaterThanOrEqual(44);
    }
  });

  it('chips are 56px', async () => {
    open('nameCityOnly');
    await stage('role');
    for (const r of screen.getAllByRole('radio')) expect(parseInt((r as HTMLElement).style.minHeight, 10)).toBe(56);
  });
});
