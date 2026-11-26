// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DraftSession } from '../../../shared/programmeModel';

const rpc = vi.hoisted(() => vi.fn());
const flag = vi.hoisted(() => ({ invites: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/lib/featureFlags', () => ({
  flags: new Proxy({}, { get: (_t, k) => (k === 'organiserClassInvites' ? flag.invites : k === 'organiserPeoplePicker' || k === 'organiserP3') }),
}));
vi.mock('../../../dates/peoplePicker', async (orig) => ({
  ...(await orig<typeof import('../../../dates/peoplePicker')>()),
  searchPickerRows: vi.fn(async (term: string) => (term === 'Zed Quinn' ? [] : [{ id: 'p1', name: 'Ana Lopez', sublabel: 'Teacher', avatarUrl: null }])),
}));
import { PeoplePickerScreen } from '../PeoplePickerScreen';
import { SessionSheetV2 } from '../SessionSheetV2';

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const ROW = 'picker-invite-row';

afterEach(() => { cleanup(); rpc.mockReset(); flag.invites = true; });

describe('picker invite row', () => {
  const mount = (onInvite?: (n: string) => void) => {
    render(<QueryClientProvider client={qc()}><PeoplePickerScreen role="teaching" onIds={new Set()} onPick={vi.fn()} onBack={vi.fn()} onInvite={onInvite} /></QueryClientProvider>);
  };
  const type = (v: string) => fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: v } });

  it('no one found: shows the no-results line and the invite row with the typed name', async () => {
    const onInvite = vi.fn();
    mount(onInvite);
    type('Zed Quinn ');
    expect(await screen.findByText('No one found for that name.')).toBeTruthy();
    const row = await screen.findByTestId(ROW);
    expect(row.textContent).toContain('Invite “Zed Quinn” on WhatsApp');
    fireEvent.click(row);
    expect(onInvite).toHaveBeenCalledWith('Zed Quinn');
  });
  it('with results: the invite row comes last, under the people', async () => {
    mount(vi.fn());
    type('Ana');
    expect(await screen.findByText('Ana Lopez')).toBeTruthy();
    const row = await screen.findByTestId(ROW);
    const opts = screen.getAllByRole('option');
    expect(opts[opts.length - 1]).toBe(row);
  });
  it('one-letter search: no invite row', async () => {
    mount(vi.fn());
    type('Z');
    await waitFor(() => expect(screen.queryByTestId(ROW)).toBeNull());
  });
  it('no onInvite (DJs, flag off, unsaved class): no invite row', async () => {
    mount();
    type('Zed Quinn');
    expect(await screen.findByText('No one found for that name.')).toBeTruthy();
    expect(screen.queryByTestId(ROW)).toBeNull();
  });
});

describe('session sheet: picker > invite sheet', () => {
  const row = (orig: Record<string, unknown> | null = { series_item_id: 'i1' }): DraftSession =>
    ({ key: 's:i1', original: orig, type: 'class', title: 'Salsa basics', start: '19:30', end: '20:30', levels: [], removed: false, people: [] });
  const show = (r: DraftSession) => {
    rpc.mockImplementation(async (fn: string) => (fn === 'organiser_class_invite_list_v1' ? { data: [], error: null } : { data: { invite_id: 'n1', token: 'tok1', expires_at: null }, error: null }));
    render(<QueryClientProvider client={qc()}><SessionSheetV2 row={r} count={2} ctx="night" dayLabel="x"
      invite={{ occurrenceId: 'o1', eventName: 'Friday Social', dateLabel: 'Thursday 26 November', canForwardItem: true }}
      onDone={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>);
  };
  const search = async () => {
    fireEvent.click(screen.getByLabelText('Teachers add'));
    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Zed Quinn' } });
    expect(await screen.findByText('No one found for that name.')).toBeTruthy();
  };

  it('tapping the row closes the picker and opens the invite sheet with the name filled', async () => {
    show(row());
    await search();
    fireEvent.click(screen.getByTestId(ROW));
    expect(screen.queryByTestId('people-picker')).toBeNull();
    const input = await screen.findByLabelText('Their name') as HTMLInputElement;
    expect(input.value).toBe('Zed Quinn');
    fireEvent.click(screen.getByText('This date and all later dates'));
    await waitFor(() => expect(rpc.mock.calls.some((c) => c[0] === 'organiser_class_invite_create_v1' && c[1].p_name === 'Zed Quinn' && c[1].p_forward === true)).toBe(true));
    expect(await screen.findByText('Send this to Zed')).toBeTruthy();
  });
  it('flag off: picker has no invite row', async () => {
    flag.invites = false;
    show(row());
    await search();
    expect(screen.queryByTestId(ROW)).toBeNull();
  });
  it('unsaved class: picker has no invite row', async () => {
    show(row(null));
    await search();
    expect(screen.queryByTestId(ROW)).toBeNull();
  });
});
