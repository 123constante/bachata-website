import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

import RaffleDoor, { formatDoorDate } from '../RaffleDoor';

const reply = (status: string) => ({
  data: { status, name: 'Aisha K.', event: 'Friday Social', date: '2026-11-28', admitted_at_local: '21:40' },
  error: null,
});

function mount() {
  return render(
    <MemoryRouter initialEntries={['/raffle/door/tok']}>
      <Routes><Route path="/raffle/door/:token" element={<RaffleDoor />} /></Routes>
    </MemoryRouter>,
  );
}

describe('formatDoorDate', () => {
  it('formats a London date without timezone shift', () => {
    expect(formatDoorDate('2026-11-28')).toBe('Fri 28 Nov');
    expect(formatDoorDate('2026-07-01T23:30:00')).toBe('Wed 1 Jul');
    expect(formatDoorDate('')).toBe('');
  });
});

describe('RaffleDoor status -> screen', () => {
  beforeEach(() => h.rpc.mockReset());

  it('valid shows card then Admitted after tap', async () => {
    h.rpc.mockResolvedValueOnce(reply('valid')).mockResolvedValueOnce(reply('valid'));
    mount();
    expect(await screen.findByText('Valid prize')).toBeTruthy();
    expect(screen.getByText('Aisha K.')).toBeTruthy();
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
  });

  it('network error offers Retry', async () => {
    h.rpc.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(reply('valid'));
    mount();
    fireEvent.click(await screen.findByText('Retry'));
    await waitFor(() => expect(screen.getByText('Valid prize')).toBeTruthy());
  });
});
