// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setTestUser } from '@/modules/dancer-app/shell/testAuth';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

import RaffleDoor, { formatDoorDate } from '../RaffleDoor';

const reply = (status: string, extra: Record<string, unknown> = {}) => ({
  data: { status, name: 'Aisha K.', event: 'Friday Social', date: '2025-11-28', admitted_at_local: '21:40', ...extra },
  error: null,
});
const admittedReply = () => ({ data: { status: 'admitted', name: 'Aisha K.', event: 'Friday Social', date: '2025-11-28' }, error: null });

function mount() {
  return render(
    <MemoryRouter initialEntries={['/raffle/door/tok']}>
      <Routes><Route path="/raffle/door/:token" element={<RaffleDoor />} /></Routes>
    </MemoryRouter>,
  );
}

describe('formatDoorDate', () => {
  it('formats a London date without timezone shift', () => {
    expect(formatDoorDate('2025-11-28')).toBe('Fri 28 Nov');
    expect(formatDoorDate('2026-07-01T23:30:00')).toBe('Wed 1 Jul');
    expect(formatDoorDate('')).toBe('');
  });
});

describe('RaffleDoor status -> screen', () => {
  beforeEach(() => { h.rpc.mockReset(); setTestUser(null); });
  afterEach(() => cleanup());

  it('valid shows card then Admitted after tap', async () => {
    h.rpc.mockResolvedValueOnce(reply('valid')).mockResolvedValueOnce(admittedReply());
    mount();
    expect(await screen.findByText('Valid prize')).toBeTruthy();
    expect(screen.getByText('Aisha K.')).toBeTruthy();
    expect(screen.queryByTestId('door-photo')).toBeNull();
    expect(screen.queryByText('Show this to the door')).toBeNull();
    expect(screen.getByText(/Friday Social/).textContent).toContain('Fri 28 Nov');
    fireEvent.click(screen.getByText('Admit'));
    expect(await screen.findByText('Admitted')).toBeTruthy();
    expect(screen.getByText('Aisha K. is in. Marked as attended.')).toBeTruthy();
    expect(h.rpc).toHaveBeenLastCalledWith('raffle_door_admit_v1', { p_qr_token: 'tok' });
  });

  it('raced admit shows Already admitted', async () => {
    h.rpc.mockResolvedValueOnce(reply('valid')).mockResolvedValueOnce(reply('already_admitted'));
    mount();
    fireEvent.click(await screen.findByText('Admit'));
    expect(await screen.findByText('Already admitted')).toBeTruthy();
  });

  it('already_admitted on load', async () => {
    h.rpc.mockResolvedValueOnce(reply('already_admitted'));
    mount();
    expect(await screen.findByText('Already admitted')).toBeTruthy();
    expect(screen.getByText(/used at 21:40\. Do not admit again\./)).toBeTruthy();
  });

  it('not_valid', async () => {
    h.rpc.mockResolvedValueOnce(reply('not_valid'));
    mount();
    expect(await screen.findByText('Not valid')).toBeTruthy();
    expect(
      screen.getByText('This code is cancelled or for another night. Ask the organiser for help.'),
    ).toBeTruthy();
  });

  it('too_early: title with date, name + event, no Admit, no photo when absent', async () => {
    h.rpc.mockResolvedValueOnce(reply('too_early', { date: '2026-12-06' }));
    mount();
    expect(await screen.findByText('Valid on Sun 6 Dec. Come back then.')).toBeTruthy();
    expect(screen.getByText('Aisha K.')).toBeTruthy();
    expect(screen.getByText(/Friday Social/)).toBeTruthy();
    expect(screen.queryByText('Admit')).toBeNull();
    expect(screen.queryByTestId('door-photo')).toBeNull();
  });

  it('photo_url shows a round photo above the name on valid, too_early, already_admitted, admitted', async () => {
    for (const status of ['valid', 'too_early', 'already_admitted', 'admitted']) {
      h.rpc.mockReset();
      h.rpc.mockResolvedValueOnce(reply(status, { photo_url: 'https://x/p.jpg' }));
      const { unmount } = mount();
      const img = await screen.findByTestId('door-photo');
      expect(img.getAttribute('src')).toBe('https://x/p.jpg');
      expect(img.getAttribute('width')).toBe('160');
      unmount();
    }
  });

  it('null photo_url and unknown status behave as before', async () => {
    h.rpc.mockResolvedValueOnce(reply('valid', { photo_url: null }));
    const a = mount();
    expect(await screen.findByText('Admit')).toBeTruthy();
    expect(screen.queryByTestId('door-photo')).toBeNull();
    a.unmount();
    h.rpc.mockResolvedValueOnce(reply('something_new'));
    mount();
    expect(await screen.findByText('Not valid')).toBeTruthy();
  });

  it('winner viewer: Show this to the door, no Admit', async () => {
    setTestUser({ id: 'u1' });
    h.rpc.mockImplementation(async (fn: string) =>
      fn === 'raffle_my_wins_v1' ? { data: [{ win: { state: 'locked', qr_token: 'tok' } }], error: null } : reply('valid'));
    mount();
    expect(await screen.findByText('Show this to the door')).toBeTruthy();
    expect(screen.getByText('Valid prize')).toBeTruthy();
    expect(screen.getByText('Aisha K.')).toBeTruthy();
    expect(screen.queryByText('Admit')).toBeNull();
  });

  it('signed in but another person\'s token: Admit stays', async () => {
    setTestUser({ id: 'u1' });
    h.rpc.mockImplementation(async (fn: string) =>
      fn === 'raffle_my_wins_v1' ? { data: [{ win: { state: 'locked', qr_token: 'other' } }], error: null } : reply('valid'));
    mount();
    expect(await screen.findByText('Admit')).toBeTruthy();
    expect(screen.queryByText('Show this to the door')).toBeNull();
  });

  it('network error offers Retry', async () => {
    h.rpc.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(reply('valid'));
    mount();
    fireEvent.click(await screen.findByText('Retry'));
    await waitFor(() => expect(screen.getByText('Valid prize')).toBeTruthy());
  });
});
