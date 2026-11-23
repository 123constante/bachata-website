// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const roomRows = vi.hoisted(() => ({ value: [] as Array<{ id: string; name: string; sort_order: number }> }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) chain[m] = () => chain;
  chain.order = async () => ({ data: roomRows.value, error: null });
  return { supabase: { from: () => chain, rpc: vi.fn() } };
});

import { SessionsSheetLook } from '../SessionsSheetLook';
import { emptyForm, type SessForm } from '../../data/sessions';

afterEach(cleanup);

function open(over: { forms?: SessForm[]; venueId?: string | null; teachers?: boolean; onDone?: (s: SessForm[]) => void } = {}) {
  const onDone = over.onDone ?? vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SessionsSheetLook forms={over.forms ?? [{ ...emptyForm('class'), title: 'Beginners', start: '19:00', end: '20:00' }]} venueId={over.venueId ?? null} teachers={over.teachers ?? false} onDone={onDone} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return onDone;
}

describe('create look: classes sheet in the edit-page look', () => {
  it('shows the edit sheet fields and buttons', () => {
    open();
    for (const t of ['Title', 'Type', 'Starts', 'Ends', 'Level', 'Done', 'Remove this one', 'Add another']) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByTestId('p3-new-sess-type-party')).toBeTruthy();
  });

  it('room picker only when the venue has rooms; the pick is returned', async () => {
    roomRows.value = [];
    const a = open({ venueId: 'v1' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('p3-new-sess-rooms')).toBeNull();
    cleanup();
    roomRows.value = [{ id: 'r1', name: 'Main', sort_order: 1 }, { id: 'r2', name: 'Loft', sort_order: 2 }];
    open({ venueId: 'v1', onDone: a });
    fireEvent.click(await screen.findByText('Loft'));
    fireEvent.click(screen.getByTestId('p3-new-sess-done'));
    expect((a as ReturnType<typeof vi.fn>).mock.calls[0][0][0]).toMatchObject({ roomId: 'r2', roomName: 'Loft' });
  });

  it('teachers group only with the picker flag prop, and only on teaching types', () => {
    open({ teachers: false });
    expect(screen.queryByText('Teachers')).toBeNull();
    cleanup();
    open({ teachers: true });
    expect(screen.getByText('Teachers')).toBeTruthy();
    fireEvent.click(screen.getByTestId('p3-new-sess-type-party'));
    expect(screen.queryByText('Teachers')).toBeNull();
  });

  it('add another, remove, and Done returns the forms', async () => {
    const done = open();
    fireEvent.click(screen.getByTestId('p3-new-sess-add'));
    expect(screen.getAllByTestId('p3-new-sess')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('p3-new-sess-remove')[0]);
    fireEvent.click(screen.getByTestId('p3-new-sess-done'));
    await waitFor(() => expect(done).toHaveBeenCalled());
    const out = (done as ReturnType<typeof vi.fn>).mock.calls[0][0] as SessForm[];
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('party');
  });
});
