// @vitest-environment jsdom
/**
 * The series editor's safety nets: leaving with unsaved edits is stopped, a save
 * offers "View on the site" for a live event, and pause asks again before it is sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('../components/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));

import { SeriesEditor } from '../components/SeriesEditor';
import type { SeriesWorkspace, WorkspaceSeries } from '../seriesModel';

const series = (status: string) => ({
  id: 's1', name: 'Thursday Class', slug: 'thursday-class', format: 'recurring', category: 'class',
  lifecycle_status: status, version: 3, default_venue_id: 'v1', default_local_start_time: '20:00:00',
  default_duration: '02:00:00', default_level: 'improver', default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
}) as WorkspaceSeries;
const workspace = (status = 'live'): SeriesWorkspace => ({ series: series(status), hasSessions: false, dates: [] });

const commandCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5');

function mount(status = 'live') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SeriesEditor workspace={workspace(status)} today="2026-10-05" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const beforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true, new_version: 4 }, error: null });
});
afterEach(cleanup);

describe('SeriesEditor', () => {
  it('has no Level field', () => {
    mount();
    expect(document.getElementById('series-level')).toBeNull();
  });

  it('closing the tab is stopped only while there are unsaved edits', () => {
    mount();
    expect(beforeUnload()).toBe(false);
    expect(screen.queryByTestId('basics-unsaved')).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    expect(screen.getByTestId('basics-unsaved')).toBeTruthy();
    expect(beforeUnload()).toBe(true);
    fireEvent.click(screen.getByTestId('basics-discard'));
    expect(beforeUnload()).toBe(false);
  });

  it('a save sends no default_level and offers View on the site for a live event', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    await waitFor(() => expect(commandCalls()).toHaveLength(1));
    const payload = JSON.stringify(commandCalls()[0][1]);
    expect(payload).toContain('Thursday Bachata');
    expect(payload).not.toContain('default_level');
    const link = await screen.findByTestId('view-on-site');
    expect(link.getAttribute('href')).toBe('/event/thursday-class');
  });

  it('a draft has no public page, so no View on the site link after a save', async () => {
    mount('draft');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    await screen.findByTestId('series-confirmation');
    expect(screen.queryByTestId('view-on-site')).toBeNull();
  });

  it('pause asks again with the consequence, and sends nothing until confirmed', async () => {
    mount();
    fireEvent.click(screen.getByTestId('lifecycle-paused'));
    const panel = await screen.findByTestId('archive-confirm');
    expect(panel.textContent).toMatch(/hidden from dancers/);
    expect(commandCalls()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('confirm-go'));
    await waitFor(() => expect(commandCalls()).toHaveLength(1));
  });

  it('archive needs the tick before the red button works', async () => {
    mount();
    fireEvent.click(screen.getByTestId('lifecycle-archived'));
    await screen.findByTestId('archive-confirm');
    const go = screen.getByTestId('confirm-go') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('confirm-ack'));
    expect(go.disabled).toBe(false);
  });
});
