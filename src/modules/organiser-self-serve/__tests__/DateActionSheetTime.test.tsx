// @vitest-environment jsdom
/**
 * S6: "Change the time" for one date. An end before the start is saved by the
 * server as an overnight slot, so a 23 h 45 min result must be confirmed; a
 * normal overnight party (22:00 to 02:00) must stay one tap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { DateActionSheet } from '../components/DateActionSheet';
import type { WorkspaceDate, WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';

const series = {
  id: 's1', name: 'Thursday Class', slug: 'thursday-class', format: 'recurring', category: 'class',
  lifecycle_status: 'live', version: 3, default_venue_id: null, default_local_start_time: '20:00:00',
  default_duration: '03:30:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
} as WorkspaceSeries;
const date: WorkspaceDate = {
  id: 'o1', occurrence_date: '2026-10-08', lifecycle_status: 'scheduled', version: 1, has_override: false,
  session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DateActionSheet open onOpenChange={() => {}} seriesId="s1" series={series} date={date} hasSessions={false} today="2026-10-05" />
    </QueryClientProvider>,
  );
  return screen.findByTestId('action-time').then((b) => fireEvent.click(b));
}
const setTimes = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('Starts'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('Ends'), { target: { value: end } });
};
const save = () => screen.getByTestId('date-save') as HTMLButtonElement;

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) =>
    fn === 'event_view_p5'
      ? { data: { occurrence: { id: 'o1', date: '2026-10-08', version: 1 }, event: {}, schedule: { local_start_time: '20:00:00', local_end_time: '23:30:00' } }, error: null }
      : { data: [], error: null },
  );
});
afterEach(cleanup);

describe('DateActionSheet change the time (S6)', () => {
  it('a normal overnight party saves with no warning', async () => {
    await mount();
    setTimes('22:00', '02:00');
    await waitFor(() => expect(save().disabled).toBe(false));
    expect(screen.queryByTestId('time-span-warning')).toBeNull();
  });

  it('end before start warns and blocks Save until confirmed; editing a time re-arms it', async () => {
    await mount();
    setTimes('21:15', '21:00');
    const warning = await screen.findByTestId('time-span-warning');
    expect(warning.textContent).toMatch(/23 h 45 min/);
    expect(warning.textContent).toMatch(/next day/);
    expect(save().disabled).toBe(true);

    fireEvent.click(screen.getByTestId('time-span-confirm'));
    expect(save().disabled).toBe(false);

    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '20:45' } });
    expect(screen.getByTestId('time-span-warning')).toBeTruthy();
    expect(save().disabled).toBe(true);
  });

  it('fixing the end clears the warning', async () => {
    await mount();
    setTimes('21:15', '21:00');
    await screen.findByTestId('time-span-warning');
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '23:30' } });
    expect(screen.queryByTestId('time-span-warning')).toBeNull();
    expect(save().disabled).toBe(false);
  });
});
