// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';
import { organisersPayload } from '../editorModel';

const role = vi.hoisted(() => ({ v: { role: 'owner', loading: false, myPages: [] as unknown[] } }));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({
  fetchOrganiserPages: async (ids: string[]) => ids.map((i) => ({ id: i, name: `Org ${i}` })),
  useSeriesRole: () => role.v,
}));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EveryBody } from '../EveryBody';

const ws = (over: Record<string, unknown> = {}, series: Record<string, unknown> = {}) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, ...series },
  gallery: [], musicStyles: ['Sensual', 'Zouk'], organiserIds: ['a', 'b'], endedOn: null, dates: [], ...over,
}) as unknown as EventWorkspace;
type Call = [{ part: string; target: string; id: string; version: number; command: { kind: string; payload: Record<string, unknown> } }[], Record<string, unknown>[], string];
const mount = (w = ws()) => {
  const saveNow = vi.fn(async () => ({ ok: true, error: null }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EveryBody ws={w} day="Thursday" saveNow={saveNow} /></QueryClientProvider>);
  return saveNow;
};
const open = (id: string) => fireEvent.click(screen.getByTestId(id).querySelector('button')!);
afterEach(() => { cleanup(); role.v = { role: 'owner', loading: false, myPages: [] }; });

describe('Music sheet', () => {
  it('shows five chips, picked ones pressed', () => {
    mount(); open('row-music');
    expect(screen.getAllByText('Music').length).toBeGreaterThan(1);
    for (const c of ['Bachata', 'Sensual', 'Dominican', 'Salsa', 'Kizomba']) expect(screen.getByRole('button', { name: c })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sensual' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Salsa' }).getAttribute('aria-pressed')).toBe('false');
  });
  it('unchanged closes with no save', () => {
    const save = mount(); open('row-music');
    fireEvent.click(screen.getByTestId('music-done'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('music-done')).toBeNull();
  });
  it('saves one upsert in chip order, keeps extras, before and label for Undo', async () => {
    const save = mount(); open('row-music');
    fireEvent.click(screen.getByRole('button', { name: 'Bachata' }));
    fireEvent.click(screen.getByTestId('music-done'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [steps, before, label] = save.mock.calls[0] as unknown as Call;
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ part: 'Music', target: 'series', id: 's1', version: 7, order: 1 });
    expect(steps[0].command.kind).toBe('series.upsert');
    expect(steps[0].command.payload).toEqual({ name: 'Thursdays', default_music_styles: ['Bachata', 'Sensual', 'Zouk'] });
    expect(before).toEqual([{ name: 'Thursdays', default_music_styles: ['Sensual', 'Zouk'] }]);
    expect(label).toBe('Saved for every Thursday');
  });
});

describe('Organisers sheet', () => {
  const mine = [
    { id: 'a', name: 'Org a', avatar_url: null, lifecycle_status: 'live' },
    { id: 'c', name: 'Casa', avatar_url: null, lifecycle_status: 'live' },
    { id: 'd', name: 'Draft page', avatar_url: null, lifecycle_status: 'draft' },
  ];
  it('adds an own live page, saves the complete ordered list', async () => {
    role.v = { role: 'owner', loading: false, myPages: mine };
    const save = mount(); await waitFor(() => expect(screen.getByTestId('row-organisers').textContent).toContain('Org a'));
    open('row-organisers');
    expect(screen.getByText('Who runs it')).toBeTruthy();
    const sel = screen.getByLabelText('Organiser page') as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Choose a page', 'Casa']);
    fireEvent.change(sel, { target: { value: 'c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: 'Remove Casa' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-done'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const [steps, before, label] = save.mock.calls[0] as unknown as Call;
    expect(steps[0]).toMatchObject({ part: 'Organisers', target: 'series', id: 's1', version: 7, order: 1 });
    expect(steps[0].command.kind).toBe('series.set_organisers');
    expect(steps[0].command.payload).toEqual(organisersPayload(['a', 'b', 'c']));
    expect(before).toEqual([organisersPayload(['a', 'b'])]);
    expect(label).toBe('Saved for every Thursday');
  });
  it('remove then Done saves the list without it; last organiser has no x', async () => {
    const save = mount(); await waitFor(() => expect(screen.getByTestId('row-organisers').textContent).toContain('Org a'));
    open('row-organisers');
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Org a' }));
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.getByText('An event needs at least one organiser.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-done'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0] as unknown as Call)[0][0].command.payload).toEqual(organisersPayload(['b']));
  });
  it('no addable page shows the hint; unchanged Done saves nothing', () => {
    const save = mount(); open('row-organisers');
    expect(screen.getByTestId('org-add-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-done'));
    expect(save).not.toHaveBeenCalled();
  });
  it('read-only for a non-organiser: no x, no add, reason, Done only closes', () => {
    role.v = { role: null as unknown as string, loading: false, myPages: mine };
    const save = mount(); open('row-organisers');
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByLabelText('Organiser page')).toBeNull();
    expect(screen.getByText('Only the people who run this event can change who runs it.')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-done'));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByTestId('org-done')).toBeNull();
  });
});
