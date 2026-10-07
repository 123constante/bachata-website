// @vitest-environment jsdom
/**
 * Cancel and remove on one date need a second, explicit step: the consequence in
 * plain words, a tick, then the red button. Nothing is sent before that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import { DateActionSheet } from '../components/DateActionSheet';
import type { WorkspaceDate, WorkspaceSeries } from '../seriesModel';

const series = {
  id: 's1', name: 'Thursday Class', slug: 'thursday-class', format: 'recurring', category: 'class',
  lifecycle_status: 'live', version: 3, default_venue_id: null, default_local_start_time: '20:00:00',
  default_duration: '02:00:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
} as WorkspaceSeries;
const date: WorkspaceDate = {
  id: 'o1', occurrence_date: '2026-10-08', lifecycle_status: 'scheduled', version: 1, has_override: false,
  session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
};

const commandCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'occurrence_command_p5' || fn === 'series_command_p5');

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DateActionSheet open onOpenChange={() => {}} seriesId="s1" series={series} date={date} hasSessions={false} today="2026-10-05" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: [{ key: 'ill', label: 'Teacher is ill' }], error: null }) }) }) });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: '2026-10-08', version: 1 }, event: {}, schedule: {} }, error: null };
    return { data: { ok: true, new_version: 2 }, error: null };
  });
});
afterEach(cleanup);

describe('DateActionSheet hard confirm', () => {
  it('cancel: pick a reason, Next, then a tick, then the red button sends it', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('action-cancel'));
    const reason = await screen.findByTestId('cancel-reason');
    fireEvent.click(reason);
    fireEvent.click(screen.getByTestId('cancel-next'));

    const panel = await screen.findByTestId('cancel-confirm-panel');
    expect(panel.textContent).toMatch(/Dancers will see/);
    expect(panel.textContent).toContain('Teacher is ill');
    expect(commandCalls()).toHaveLength(0);

    const go = screen.getByTestId('confirm-go') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(go);
    expect(commandCalls()).toHaveLength(0);

    fireEvent.click(screen.getByTestId('confirm-ack'));
    expect(go.disabled).toBe(false);
    fireEvent.click(go);
    await waitFor(() => expect(commandCalls()).toHaveLength(1));
    expect(commandCalls()[0][0]).toBe('occurrence_command_p5');
    expect(await screen.findByTestId('date-done')).toBeTruthy();
    expect(screen.getByTestId('date-view-on-site').getAttribute('href')).toBe('/event/thursday-class');
  });

  it('cancel: Next stays off until a reason is chosen, and "No, keep it on" sends nothing', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('action-cancel'));
    await screen.findByTestId('cancel-reason');
    expect((screen.getByTestId('cancel-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('cancel-reason'));
    fireEvent.click(screen.getByTestId('cancel-next'));
    fireEvent.click(await screen.findByTestId('confirm-keep'));
    expect(await screen.findByTestId('cancel-panel')).toBeTruthy();
    expect(commandCalls()).toHaveLength(0);
  });

  it('remove: opens the confirm step first, and keeping it returns to the menu without sending', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('action-remove'));
    const panel = await screen.findByTestId('remove-confirm-panel');
    expect(panel.textContent).toMatch(/disappears/);
    expect(commandCalls()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('confirm-keep'));
    expect(await screen.findByTestId('action-remove')).toBeTruthy();
    expect(commandCalls()).toHaveLength(0);
  });

  it('remove: the tick unlocks the red button, which then sends the removal', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('action-remove'));
    await screen.findByTestId('remove-confirm-panel');
    expect((screen.getByTestId('confirm-go') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('confirm-ack'));
    fireEvent.click(screen.getByTestId('confirm-go'));
    await waitFor(() => expect(commandCalls().length).toBeGreaterThan(0));
    expect(commandCalls()[0][0]).toBe('series_command_p5');
  });
});
