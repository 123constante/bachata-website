// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: null as unknown, isLoading: false }));
const edit = vi.hoisted(() => vi.fn());
const saveProfile = vi.hoisted(() => vi.fn());
const saveRole = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: rpc }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/modules/dancer-app/api/rpc', () => ({ fetchMyDancerEdit: edit, saveMyDancerProfile: saveProfile }));
vi.mock('@/modules/areas/shared/areaApi', () => ({ saveMyRole: saveRole }));
import ClassJoinPage from '../ClassJoinPage';
import { codeOf, firstName, joinAuthHref, longDay, splitName } from '../classJoinApi';

const OPEN = { valid: true, status: 'open', display_name: 'Ana Lopez', event_name: 'Friday Social', class_title: 'Salsa basics', night_date: '2026-11-26', forward: false };
const REDEEMED = { invite_id: 'i', nights_attached: 1, already: false, event_name: 'Friday Social', class_title: 'Salsa basics', first_date: '2026-11-26' };
let peekAnswer: unknown = OPEN;
let redeemQueue: Array<{ data?: unknown; error?: { message: string } }> = [];

const mount = () => render(
  <MemoryRouter initialEntries={['/join/class/tok']}>
    <Routes><Route path="/join/class/:token" element={<ClassJoinPage />} /><Route path="*" element={<div>elsewhere</div>} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  peekAnswer = OPEN; redeemQueue = []; auth.user = null; auth.isLoading = false;
  edit.mockResolvedValue({ first_name: null }); saveProfile.mockResolvedValue({}); saveRole.mockResolvedValue({});
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'peek_class_invite_v1') return { data: peekAnswer, error: null };
    if (fn === 'ensure_my_dancer_profile_v1') return { data: { profile_id: 'p', created: false }, error: null };
    const next = redeemQueue.shift() ?? { data: REDEEMED };
    return { data: next.data ?? null, error: next.error ?? null };
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('helpers', () => {
  it('maps codes, names and days', () => {
    expect(codeOf({ message: 'permission_denied: no_teacher_profile' })).toBe('no_teacher_profile');
    expect(codeOf({ message: 'boom' })).toBeNull();
    expect(firstName('Ana Lopez')).toBe('Ana');
    expect(splitName('Ana Maria Lopez')).toEqual({ first: 'Ana', surname: 'Maria Lopez' });
    expect(longDay('2026-11-26')).toBe('Thursday 26 November');
    expect(joinAuthHref('tok', 'signup')).toBe('/auth?mode=signup&returnTo=%2Fjoin%2Fclass%2Ftok');
  });
});

describe('ClassJoinPage', () => {
  it('shows a spinner while peeking', () => {
    mount();
    expect(screen.getByRole('status')).toBeTruthy();
  });
  it.each(['claimed', 'revoked', 'expired', 'invalid'])('not open (%s)', async (status) => {
    peekAnswer = { valid: false, status };
    mount();
    expect(await screen.findByText('This link doesn’t work any more')).toBeTruthy();
    expect(screen.getByText('Ask the organiser to send you a new one.')).toBeTruthy();
    expect(screen.getByText('Go to Bachata Calendar').getAttribute('href')).toBe('/');
  });
  it('signed out: greeting, line, both auth links return here', async () => {
    mount();
    expect(await screen.findByText('Hi Ana')).toBeTruthy();
    expect(screen.getByText(/teaching Salsa basics at Friday Social on Thursday 26 November$/)).toBeTruthy();
    expect(screen.getByText('Join and show on the class').getAttribute('href')).toBe('/auth?mode=signup&returnTo=%2Fjoin%2Fclass%2Ftok');
    expect(screen.getByText('I already have an account').getAttribute('href')).toBe('/auth?mode=signin&returnTo=%2Fjoin%2Fclass%2Ftok');
  });
  it('forward adds the weeks-after suffix', async () => {
    peekAnswer = { ...OPEN, forward: true };
    mount();
    expect(await screen.findByText(/and the weeks after$/)).toBeTruthy();
  });
  it('signed in with a teacher profile: one tap to done; already=true is the same screen', async () => {
    auth.user = { id: 'u' };
    redeemQueue = [{ data: { ...REDEEMED, already: true } }];
    mount();
    fireEvent.click(await screen.findByText('Show me on the class'));
    expect(await screen.findByText('You’re on the class')).toBeTruthy();
    expect(screen.getByText(/Salsa basics at Friday Social, from Thursday 26 November\./)).toBeTruthy();
    expect(screen.getByText('See my teacher area').getAttribute('href')).toBe('/account/t');
    expect(screen.getByText('Done').getAttribute('href')).toBe('/');
  });
  it('no teacher profile: details step, prefilled, levels required, redeem retried', async () => {
    auth.user = { id: 'u' };
    redeemQueue = [{ error: { message: 'permission_denied: no_teacher_profile' } }];
    mount();
    fireEvent.click(await screen.findByText('Show me on the class'));
    expect(await screen.findByText('Last step: your teacher details')).toBeTruthy();
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Ana');
    expect((screen.getByLabelText('Surname') as HTMLInputElement).value).toBe('Lopez');
    const save = screen.getByText('Save and show me on the class') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByText('Advanced'));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(await screen.findByText('You’re on the class')).toBeTruthy();
    expect(saveProfile).toHaveBeenCalledWith({ first_name: 'Ana', surname: 'Lopez' });
    expect(saveRole).toHaveBeenCalledWith('teacher', { levels_taught: ['Advanced'] });
    expect(rpc.mock.calls.filter((c) => c[0] === 'redeem_class_invite_v1')).toHaveLength(2);
  });
  it('name fields are hidden when the profile already has a first name', async () => {
    auth.user = { id: 'u' };
    edit.mockResolvedValue({ first_name: 'Ana' });
    redeemQueue = [{ error: { message: 'no_teacher_profile' } }];
    mount();
    fireEvent.click(await screen.findByText('Show me on the class'));
    await screen.findByText('Last step: your teacher details');
    expect(screen.queryByLabelText('First name')).toBeNull();
    fireEvent.click(screen.getByText('Beginner'));
    fireEvent.click(screen.getByText('Save and show me on the class'));
    await screen.findByText('You’re on the class');
    expect(saveProfile).not.toHaveBeenCalled();
  });
  it('expired after peek switches to the not-open screen', async () => {
    auth.user = { id: 'u' };
    redeemQueue = [{ error: { message: 'permission_denied: invite_expired' } }];
    mount();
    fireEvent.click(await screen.findByText('Show me on the class'));
    expect(await screen.findByText('This link doesn’t work any more')).toBeTruthy();
  });
  it('other errors show one plain line and the button stays', async () => {
    auth.user = { id: 'u' };
    redeemQueue = [{ error: { message: 'network down' } }];
    mount();
    fireEvent.click(await screen.findByText('Show me on the class'));
    await waitFor(() => expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy());
    expect(screen.getByText('Show me on the class')).toBeTruthy();
  });
});
