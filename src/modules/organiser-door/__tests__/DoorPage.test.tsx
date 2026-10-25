// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  fetchLookalikes: vi.fn(), startOrganiser: vi.fn(), sendDoorCode: vi.fn(), verifyDoorCode: vi.fn(),
}));
vi.mock('../doorApi', () => api);
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => <button type="button" data-testid="pick-city" onClick={() => onChange('city-1')}>pick</button>,
}));

import { DoorBody } from '../DoorPage';

const view = (p: Partial<React.ComponentProps<typeof DoorBody>> = {}) =>
  render(<MemoryRouter><DoorBody signedIn={false} resolving={false} doorOn siteKey={null} {...p} /></MemoryRouter>);

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  api.fetchLookalikes.mockResolvedValue({ kind: 'none' });
  api.sendDoorCode.mockResolvedValue({ error: null });
});

describe('door off', () => {
  it.each([[false], [true]])('closed page when signed in = %s, with working buttons and no form', (signedIn) => {
    view({ doorOn: false, signedIn });
    expect(screen.getByTestId('door-closed')).toBeTruthy();
    expect(screen.queryByTestId('door-email')).toBeNull();
    expect(screen.getAllByTestId('door-action').length).toBeGreaterThanOrEqual(3);
  });
});

describe('signed out, door on', () => {
  it('shows steps, terms line and an untouched form sends nothing', () => {
    view();
    expect(screen.getByTestId('door-steps').querySelectorAll('li').length).toBe(3);
    expect(screen.getByTestId('door-terms').textContent).toContain('By continuing you agree to the Terms and Privacy');
    expect((screen.getByTestId('door-send') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByTestId('door-email-form'));
    expect(api.sendDoorCode).not.toHaveBeenCalled();
    expect(screen.getByTestId('door-send-why').textContent).toContain('Enter your email');
  });
  it('Turnstile key unset: no widget, send has no captcha token', async () => {
    view();
    fireEvent.change(screen.getByTestId('door-email'), { target: { value: 'a@b.co' } });
    expect(screen.queryByTestId('door-turnstile')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId('door-send')); });
    expect(api.sendDoorCode).toHaveBeenCalledWith('a@b.co', null);
  });
  it('Turnstile key set: widget slot shows and send is off until a token exists', () => {
    view({ siteKey: 'site-key' });
    expect(screen.getByTestId('door-turnstile')).toBeTruthy();
    fireEvent.change(screen.getByTestId('door-email'), { target: { value: 'a@b.co' } });
    expect((screen.getByTestId('door-send') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('door-send-why').textContent).toContain('Tick the box');
  });
});

describe('signed in: start your page', () => {
  const fill = () => {
    fireEvent.change(screen.getByTestId('door-name'), { target: { value: 'Ana Nights' } });
    fireEvent.click(screen.getByTestId('pick-city'));
  };
  it('untouched form sends nothing', () => {
    view({ signedIn: true });
    expect((screen.getByTestId('door-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByTestId('door-start-form'));
    expect(api.startOrganiser).not.toHaveBeenCalled();
    expect(api.fetchLookalikes).not.toHaveBeenCalled();
  });
  it('double tap sends once', async () => {
    let release: (v: unknown) => void = () => {};
    api.startOrganiser.mockReturnValue(new Promise((r) => { release = r; }));
    view({ signedIn: true });
    fill();
    const form = screen.getByTestId('door-start-form');
    fireEvent.submit(form); fireEvent.submit(form);
    expect(api.startOrganiser).toHaveBeenCalledTimes(1);
    await act(async () => { release({ code: 'CREATED', organiserId: 'o1', missing: [] }); });
    expect(screen.getByTestId('door-result')).toBeTruthy();
  });
  it.each([
    [{ kind: 'some', items: [1, 2, 3, 4, 5].map((i) => ({ organiserId: `o${i}`, name: `N${i}`, city: 'London', slug: null, logoUrl: null })) }, 5, 'door-lookalikes'],
    [{ kind: 'some', items: [{ organiserId: 'o1', name: 'N1', city: null, slug: null, logoUrl: null }] }, 1, 'door-lookalikes'],
    [{ kind: 'none' }, 0, null],
    [{ kind: 'rate_limited' }, 0, 'door-lookalike-limited'],
    [{ kind: 'error' }, 0, 'door-lookalike-error'],
  ])('lookalikes %j', async (state, cards, id) => {
    api.fetchLookalikes.mockResolvedValue(state);
    view({ signedIn: true });
    fill();
    if (id) await waitFor(() => expect(screen.getByTestId(id)).toBeTruthy());
    else await waitFor(() => expect(api.fetchLookalikes).toHaveBeenCalled());
    expect(screen.queryAllByTestId('door-lookalike-card').length).toBe(cards);
    if (id === 'door-lookalike-limited') expect(screen.getByTestId(id).textContent).toBe('Try again in a little while');
    // the form is never blocked by the check
    expect((screen.getByTestId('door-submit') as HTMLButtonElement).disabled).toBe(false);
  });
  it('"No, create a new page" calls start once', async () => {
    api.fetchLookalikes.mockResolvedValue({ kind: 'some', items: [{ organiserId: 'o1', name: 'N1', city: null, slug: null, logoUrl: null }] });
    api.startOrganiser.mockResolvedValue({ code: 'CREATED', organiserId: 'o2', missing: [] });
    view({ signedIn: true });
    fill();
    await waitFor(() => screen.getByTestId('door-lookalike-no'));
    await act(async () => { fireEvent.click(screen.getByTestId('door-lookalike-no')); });
    expect(api.startOrganiser).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['DOOR_CLOSED', 'door-closed'], ['CREATED', 'door-result'], ['NOT_ON_LIST', 'door-result'], ['PROFILE_INCOMPLETE', 'door-result'],
    ['EMAIL_DOMAIN_NOT_ALLOWED', 'door-result'], ['ALREADY_HAS_PAGE', 'door-result'], ['unknown', 'door-result'],
    ['CITY_NOT_FOUND', 'door-inline-error'], ['NAME_REQUIRED', 'door-inline-error'],
  ])('result %s -> %s', async (code, id) => {
    api.startOrganiser.mockResolvedValue({ code, organiserId: 'o1', missing: ['photo'] });
    view({ signedIn: true });
    fill();
    await act(async () => { fireEvent.submit(screen.getByTestId('door-start-form')); });
    expect(screen.getByTestId(id)).toBeTruthy();
  });
});
