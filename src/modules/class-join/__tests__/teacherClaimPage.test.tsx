// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: null as unknown, isLoading: false }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: rpc }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
import TeacherClaimPage from '../TeacherClaimPage';
import { claimAuthHref } from '../teacherClaimApi';

const OPEN = { valid: true, status: 'open', display_name: 'Ana Lopez', event_name: 'Friday Social', night_date: '2026-11-26' };
let peekAnswer: unknown = OPEN;
let peekError: { message: string } | null = null;
let redeemAnswer: { data?: unknown; error?: { message: string } } = { data: { status: 'linked', profile_id: 'p' } };

const mount = () => render(
  <MemoryRouter initialEntries={['/claim/teacher/tok']}>
    <Routes><Route path="/claim/teacher/:token" element={<TeacherClaimPage />} /><Route path="*" element={<div>elsewhere</div>} /></Routes>
  </MemoryRouter>,
);
const calls = (fn: string) => rpc.mock.calls.filter((c) => c[0] === fn);

beforeEach(() => {
  peekAnswer = OPEN; peekError = null; redeemAnswer = { data: { status: 'linked', profile_id: 'p' } };
  auth.user = null; auth.isLoading = false;
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'peek_teacher_claim_link_v1') return peekError ? { data: null, error: peekError } : { data: peekAnswer, error: null };
    if (fn === 'redeem_teacher_claim_link_v1') return { data: redeemAnswer.data ?? null, error: redeemAnswer.error ?? null };
    throw new Error(`unexpected rpc ${fn}`);
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('TeacherClaimPage', () => {
  it('shows a spinner while peeking', () => {
    mount();
    expect(screen.getByRole('status')).toBeTruthy();
  });
  it.each(['expired', 'revoked', 'invalid'])('closed screen (%s)', async (status) => {
    peekAnswer = { valid: false, status };
    mount();
    expect(await screen.findByText('This link doesn’t work any more')).toBeTruthy();
    expect(screen.getByText('Ask the organiser to send you a new one.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Bachata Calendar' }).getAttribute('href')).toBe('/');
  });
  it('peek error is closed', async () => {
    peekError = { message: 'boom' };
    mount();
    expect(await screen.findByText('This link doesn’t work any more')).toBeTruthy();
  });
  it('peek linked and requested screens', async () => {
    peekAnswer = { valid: true, status: 'linked' };
    mount();
    expect(await screen.findByText('It’s yours')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See my teacher area' }).getAttribute('href')).toBe('/account/t');
    expect(screen.getByRole('link', { name: 'Done' }).getAttribute('href')).toBe('/');
    cleanup();
    peekAnswer = { valid: true, status: 'requested' };
    mount();
    expect(await screen.findByText('Thanks')).toBeTruthy();
    expect(screen.getByText('We’ll check it’s you and link it within a day.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Done' }).getAttribute('href')).toBe('/');
  });
  it('signed out open: auth links carry returnTo, no redeem', async () => {
    mount();
    expect(await screen.findByText('Hi Ana')).toBeTruthy();
    expect(screen.getByText(/You’re teaching at Friday Social on Thursday 26 November\./)).toBeTruthy();
    const up = screen.getByRole('link', { name: 'Create an account to claim it' }).getAttribute('href') ?? '';
    const inn = screen.getByRole('link', { name: 'I already have an account' }).getAttribute('href') ?? '';
    expect(up).toBe(claimAuthHref('tok', 'signup'));
    expect(up).toContain('mode=signup');
    expect(up).toContain('returnTo=%2Fclaim%2Fteacher%2Ftok');
    expect(inn).toContain('mode=signin');
    expect(inn).toContain('returnTo=%2Fclaim%2Fteacher%2Ftok');
    expect(screen.getByText('Use the email or Instagram the organiser has for you, so we can match you.')).toBeTruthy();
    expect(calls('redeem_teacher_claim_link_v1')).toHaveLength(0);
  });
  it.each([
    ['linked', 'It’s yours'],
    ['requested', 'Thanks'],
    ['taken', 'This link doesn’t work any more'],
    ['expired', 'This link doesn’t work any more'],
  ])('signed in redeem %s', async (status, heading) => {
    auth.user = { id: 'u' };
    redeemAnswer = { data: { status, profile_id: null } };
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Claim my profile' }));
    expect(await screen.findByText(heading)).toBeTruthy();
    expect(calls('redeem_teacher_claim_link_v1')[0]).toEqual(['redeem_teacher_claim_link_v1', { p_token: 'tok' }]);
  });
  it('thrown redeem error shows an alert and the button works again', async () => {
    auth.user = { id: 'u' };
    redeemAnswer = { error: { message: 'sign_in_required' } };
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Claim my profile' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong. Try again.');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Claim my profile' }) as HTMLButtonElement).disabled).toBe(false));
  });
  it('never creates a profile or saves', async () => {
    auth.user = { id: 'u' };
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Claim my profile' }));
    await screen.findByText('It’s yours');
    const names = rpc.mock.calls.map((c) => String(c[0]));
    expect(names.some((n) => n === 'ensure_my_dancer_profile_v1' || n.startsWith('save_'))).toBe(false);
  });
});
