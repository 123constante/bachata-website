// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  flag: { teachRequests: true },
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
}));
vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));

import { TeachThisButton } from '../schedule/TeachThisButton';

const cls = { id: 'item1', type: 'class' };
const mount = (session: { id: string; type: string; addedOnly?: boolean } = cls, occ: string | null = 'occ1') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><TeachThisButton session={session} occurrenceId={occ} /></MemoryRouter>
    </QueryClientProvider>,
  );
const reads = (rows: unknown[] = []) => (fn: string) => {
  if (fn === 'my_teach_requests_v1') return Promise.resolve({ data: rows, error: null });
  return Promise.resolve({ data: null, error: null });
};
const BTN = /teaching this/i;

beforeEach(() => { cleanup(); h.rpc.mockReset(); h.flag.teachRequests = true; h.user = { id: 'u1' }; h.rpc.mockImplementation(reads()); });

describe('TeachThisButton', () => {
  it('flag off: no button, no rpc', async () => {
    h.flag.teachRequests = false;
    mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('signed out: nothing', async () => {
    h.user = null;
    mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('class shows button, party does not', async () => {
    mount();
    expect(await screen.findByRole('button', { name: BTN })).toBeTruthy();
    mount({ id: 'p', type: 'party' });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByRole('button', { name: BTN })).toHaveLength(1);
  });
  it('added session sends the added id', async () => {
    h.rpc.mockImplementation((fn: string) => fn === 'my_teach_requests_v1'
      ? Promise.resolve({ data: [], error: null })
      : Promise.resolve({ data: { status: 'pending', request_id: 'r1' }, error: null }));
    mount({ id: 'add1', type: 'workshop', addedOnly: true });
    fireEvent.click(await screen.findByRole('button', { name: BTN }));
    await screen.findByText(/Request sent/);
    expect(h.rpc).toHaveBeenCalledWith('request_teach_class_v1', { p_occurrence_id: 'occ1', p_program_item_id: null, p_added_session_id: 'add1' });
  });
  it('pending from read shows Request sent', async () => {
    h.rpc.mockImplementation(reads([{ request_id: 'r9', program_item_id: 'item1', added_session_id: null, status: 'pending' }]));
    mount();
    expect(await screen.findByText(/Request sent/)).toBeTruthy();
  });
  it('tap -> Request sent -> Undo withdraws', async () => {
    h.rpc.mockImplementation((fn: string) => fn === 'request_teach_class_v1'
      ? Promise.resolve({ data: { status: 'pending', request_id: 'r1' }, error: null })
      : Promise.resolve({ data: [], error: null }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: BTN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('withdraw_teach_request_v1', { p_request_id: 'r1' }));
    expect(await screen.findByRole('button', { name: BTN })).toBeTruthy();
  });
  it('no_teacher_profile links to /app/me', async () => {
    h.rpc.mockImplementation((fn: string) => fn === 'request_teach_class_v1'
      ? Promise.resolve({ data: null, error: { message: 'permission_denied: no_teacher_profile' } })
      : Promise.resolve({ data: [], error: null }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: BTN }));
    const link = await screen.findByRole('link', { name: 'Add teaching' });
    expect(link.getAttribute('href')).toBe('/app/me');
  });
  it('declined shows nothing', async () => {
    h.rpc.mockImplementation(reads([{ request_id: 'r2', program_item_id: 'item1', added_session_id: null, status: 'declined' }]));
    mount();
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
