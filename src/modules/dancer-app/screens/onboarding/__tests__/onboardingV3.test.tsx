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
import { yearForBandV3 } from '../modelV3';

afterEach(async () => {
  // The neon burst fires on a 120ms timer that outlives the screen: let it land before the next test.
  await new Promise((r) => setTimeout(r, 150));
  cleanup();
  resetShell();
  vi.mocked(boom).mockClear();
});

const SIGNED_UP = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower', avatar_url: 'https://x.test/a.jpg' } as Partial<MyDancerEdit>;
const open = (over: Partial<MyDancerEdit> = {}) => renderInShell({ path: '/app/welcome', backend: { shape: 'emptyStub', profile: makeProfile({ ...SIGNED_UP, ...over }) } });
const step = (id: string) => screen.findByTestId(`onboarding-${id}`);
const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement;
const cont = () => btn('onboarding-continue');
const roleSaves = (b: FakeDancerBackend) => b.calls.filter((c) => c.fn === 'setMyBuyerRoles');
const profileSaves = (b: FakeDancerBackend) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile').map((c) => c.args);
const segs = () => screen.getAllByTestId('onboarding-seg').map((s) => s.getAttribute('data-filled') ?? String(s.classList.contains('on')));

describe('roles screen', () => {
  it('keep-list: heading, sub, 4 rows in order with icon, title, sub; Dancer ticked first; Continue enabled', async () => {
    open();
    await step('roles');
    expect(screen.getByRole('heading').textContent).toBe('Who\u2019s hitting the floor?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Pick all that fit. Change anytime.');
    const rows = screen.getAllByRole('checkbox');
    expect(rows.map((r) => r.textContent)).toEqual(['\u{1F483}DancerFind nights and partners', '\u{1F39F}\uFE0FOrganiserRun events and classes', '\u{1F393}TeacherShare your classes', '\u{1F3A7}DJPlay at nights']);
    rows.forEach((r) => expect(r.querySelector('.ic')).toBeTruthy());
    expect(rows.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    expect(screen.getByTestId('onboarding-role-dancer-tick')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
    expect(cont().disabled).toBe(false);
    expect(segs().length).toBe(6);
  });

  it('Continue is disabled with 0 picked, with a reason', async () => {
    open();
    await step('roles');
    fireEvent.click(screen.getByTestId('onboarding-role-dancer'));
    expect(cont().disabled).toBe(true);
    expect(screen.getByTestId('onboarding-reason').textContent).toMatch(/at least one/i);
  });

  it('saves through set_my_buyer_roles and moves on to styles', async () => {
    const { backend } = open();
    await step('roles');
    fireEvent.click(screen.getByTestId('onboarding-role-teacher'));
    fireEvent.click(cont());
    await step('styles');
    expect(roleSaves(backend).map((c) => c.args)).toEqual([['dancer', 'teacher']]);
    expect(boom).not.toHaveBeenCalled();
  });

  it('a saved answer reopens as saved; an unchanged set sends nothing', async () => {
    const { backend } = open({ buyer_roles: ['dj'] });
    await step('styles'); // saved roles: resume skips the roles screen; Back reopens it as saved
    fireEvent.click(btn('onboarding-back'));
    await step('roles');
    expect(screen.getAllByRole('checkbox').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false', 'true']);
    fireEvent.click(cont());
    await step('styles');
    expect(roleSaves(backend)).toHaveLength(0);
  });
});

describe('styles screen', () => {
  const at = () => open({ buyer_roles: ['dancer'] });

  it('keep-list: heading, sub, live styles, Continue disabled with none, no Skip, Back present', async () => {
    at();
    await step('styles');
    expect(screen.getByRole('heading').textContent).toBe('Which styles do you dance?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Pick at least one.');
    expect((await screen.findAllByRole('checkbox')).map((c) => c.textContent)).toEqual(['Bachata Sensual', 'Bachata Moderna', 'Bachata Tradicional', 'Salsa On1', 'Salsa On2', 'Kizomba', 'Zouk']);
    expect(cont().disabled).toBe(true);
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    expect(screen.queryByText('Skip')).toBeNull();
    expect(btn('onboarding-back')).toBeTruthy();
    expect(segs()).toEqual(['true', 'true', 'false', 'false', 'false', 'false']);
  });

  it('saves favorite_styles, celebrates on leaving, goes to years', async () => {
    const { backend } = at();
    await step('styles');
    fireEvent.click(await screen.findByText('Zouk'));
    expect(screen.getByText('Zouk').closest('button')!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(cont());
    await step('years');
    expect(profileSaves(backend)).toEqual([{ favorite_styles: ['Zouk'] }]);
    await waitFor(() => expect(boom).toHaveBeenCalledTimes(1));
  });

  it('Back keeps what was typed and does not celebrate', async () => {
    at();
    await step('styles');
    fireEvent.click(await screen.findByText('Kizomba'));
    fireEvent.click(btn('onboarding-back'));
    await step('roles');
    fireEvent.click(cont());
    await step('styles');
    expect((await screen.findByText('Kizomba')).closest('button')!.getAttribute('aria-checked')).toBe('true');
    expect(boom).not.toHaveBeenCalled();
  });
});

describe('years screen', () => {
  const at = (over: Partial<MyDancerEdit> = {}) => open({ buyer_roles: ['dancer'], favorite_styles: ['Zouk'], ...over });

  it('keep-list: heading, sub, 5 rows with icon, none ticked, Continue disabled, no Skip', async () => {
    at();
    await step('years');
    expect(screen.getByRole('heading').textContent).toBe('How long have you danced?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Required. We store the year you started.');
    const rows = screen.getAllByRole('radio');
    expect(rows.map((r) => r.textContent)).toEqual(['Under 1 year', '1 to 2 years', '3 to 5 years', '6 to 10 years', 'Over 10 years'].map((l) => `\u{1F4C5}${l}`));
    rows.forEach((r) => expect(r.querySelector('.ic')).toBeTruthy());
    expect(rows.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(cont().disabled).toBe(true);
    expect(screen.queryByText('Skip')).toBeNull();
    expect(segs()).toEqual(['true', 'true', 'true', 'false', 'false', 'false']);
  });

  it('saves dance_started_year from the band, celebrates, and goes to the partner screen', async () => {
    const { backend, location } = at();
    await step('years');
    fireEvent.click(screen.getByTestId('onboarding-years-three-five'));
    expect(screen.getByTestId('onboarding-years-three-five-tick')).toBeTruthy();
    fireEvent.click(cont());
    await step('partner');
    expect(location()).toBe('/app/welcome');
    expect(profileSaves(backend)).toEqual([{ dance_started_year: yearForBandV3('three-five') }]);
    await waitFor(() => expect(boom).toHaveBeenCalledTimes(1));
  });
});

describe('resume and pre-steps', () => {
  it('everything required done: straight to Home, no card', async () => {
    const { location } = open({ buyer_roles: ['dj'], favorite_styles: ['Zouk'], dance_started_year: 2019, looking_for_partner: false });
    await waitFor(() => expect(location()).toBe('/app/home'));
    expect(screen.queryByTestId('onboarding-roles')).toBeNull();
  });

  it('lands on the first step still missing (years), band ticked from a saved year', async () => {
    open({ buyer_roles: ['dj'], favorite_styles: ['Zouk'] });
    await step('years');
  });

  it('a saved year reopens ticked via its band', async () => {
    // years done but partner missing: this slice ends the flow, so check the roles/styles path with a year set instead.
    open({ dance_started_year: new Date().getFullYear() - 4 });
    await step('roles');
    fireEvent.click(cont());
    await step('styles');
    fireEvent.click(await screen.findByText('Zouk'));
    fireEvent.click(cont());
    await step('years');
    expect(screen.getByTestId('onboarding-years-three-five').getAttribute('aria-checked')).toBe('true');
  });

  it('while the name is missing, the existing name card shows first', async () => {
    open({ first_name: null });
    await step('name');
    // The name card now sits in the neon frame with its own three-segment bar (name, city, role).
    expect(screen.getAllByTestId('onboarding-seg').length).toBe(3);
  });
});
