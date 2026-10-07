// @vitest-environment jsdom
/**
 * The date sheet's keyboard and screen reader path: the focus starts on the date,
 * moves to each step, comes back to the menu item on Back and to the control that
 * opened the sheet on close; a failed save puts it on the message. The cancel
 * reasons are one radio group, a failed reasons load can be retried, and a date
 * with its own picture says a new series picture does not replace it.
 */
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('../components/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));

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
const REASONS = [{ key: 'ill', label: 'Teacher is ill' }, { key: 'venue', label: 'Venue unavailable' }, { key: 'weather', label: 'Bad weather' }];

let event: Record<string, unknown>;
let reasonsFail: boolean;
let commandResult: () => Promise<{ data: unknown; error: unknown }>;

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="opener">Change</button>
      <DateActionSheet open={open} onOpenChange={setOpen} seriesId="s1" series={series} date={date} hasSessions={false} today="2026-10-05" />
    </>
  );
}

async function openSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const opener = screen.getByTestId('opener');
  opener.focus();
  fireEvent.click(opener);
  await screen.findByTestId('action-cancel');
}
const focused = () => document.activeElement as HTMLElement | null;

beforeEach(() => {
  event = {};
  reasonsFail = false;
  commandResult = async () => ({ data: { ok: true, new_version: 2 }, error: null });
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => (reasonsFail ? { data: null, error: { message: 'Failed to fetch' } } : { data: REASONS, error: null }) }) }) });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: '2026-10-08', version: 1 }, event, schedule: {} }, error: null };
    return commandResult();
  });
});
afterEach(cleanup);

describe('DateActionSheet focus and announcements', () => {
  it('opens on the date title and gives the focus back to the opener on close', async () => {
    await openSheet();
    await waitFor(() => expect(focused()?.textContent).toBe('Thu 8 Oct'));
    fireEvent.keyDown(focused()!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('date-sheet')).toBeNull());
    expect(focused()).toBe(screen.getByTestId('opener'));
  });

  it('each step takes the focus to its heading, and Back returns it to the menu item', async () => {
    await openSheet();
    fireEvent.click(screen.getByTestId('action-time'));
    await waitFor(() => expect(focused()?.tagName).toBe('H3'));
    expect(focused()?.textContent).toBe('Change the time');
    fireEvent.click(screen.getByTestId('date-back'));
    await waitFor(() => expect(focused()).toBe(screen.getByTestId('action-time')));
  });

  it('the confirm step takes the focus to the tick, and keeping the date returns it to Remove', async () => {
    await openSheet();
    fireEvent.click(screen.getByTestId('action-remove'));
    await screen.findByTestId('remove-confirm-panel');
    await waitFor(() => expect(focused()).toBe(screen.getByTestId('confirm-ack')));
    fireEvent.click(screen.getByTestId('confirm-keep'));
    await waitFor(() => expect(focused()).toBe(screen.getByTestId('action-remove')));
  });

  it('a failed save puts the focus on the message; saving is said in words', async () => {
    let fail: (v: { data: unknown; error: unknown }) => void = () => {};
    commandResult = () => new Promise((r) => { fail = r; });
    await openSheet();
    fireEvent.click(screen.getByTestId('action-note'));
    fireEvent.change(screen.getByLabelText('Note for Thu 8 Oct'), { target: { value: 'Cover teacher' } });
    fireEvent.click(screen.getByTestId('date-save'));
    await waitFor(() => expect(screen.getByTestId('date-saving').textContent).toBe('Saving…'));
    fail({ data: null, error: { message: 'Failed to fetch' } });
    const message = await screen.findByTestId('date-error');
    await waitFor(() => expect(focused()).toBe(message));
    expect(screen.getByTestId('date-saving').textContent).toBe('');
  });

  it('a result takes the focus, and so does the result of Undo on the same step', async () => {
    await openSheet();
    fireEvent.click(screen.getByTestId('action-cancel'));
    fireEvent.click((await screen.findAllByTestId('cancel-reason'))[0]);
    fireEvent.click(screen.getByTestId('cancel-next'));
    fireEvent.click(await screen.findByTestId('confirm-ack'));
    fireEvent.click(screen.getByTestId('confirm-go'));
    const undo = await screen.findByTestId('date-undo');
    await waitFor(() => expect(focused()?.textContent).toContain('Thu 8 Oct is cancelled.'));
    undo.focus(); // as a tap or a key press would; the Undo button then goes away with the new result
    fireEvent.click(undo);
    await screen.findByText(/Thu 8 Oct is back on\./);
    // The result line itself, not just somewhere in the sheet (Radix would park it on the whole dialog).
    await waitFor(() => expect(focused()?.hasAttribute('data-step-focus')).toBe(true));
    expect(focused()?.textContent).toContain('Thu 8 Oct is back on.');
  });

  it('the cancel reasons are one radio group with one tab stop, moved with the arrow keys', async () => {
    await openSheet();
    fireEvent.click(screen.getByTestId('action-cancel'));
    const group = await screen.findByRole('radiogroup', { name: 'Why? Dancers see this.' });
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(focused()).toBe(radios[1]);
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(radios[2].getAttribute('aria-checked')).toBe('true'); // wraps round
  });

  it('reasons that fail to load say so and can be retried, instead of a Next that never turns on', async () => {
    reasonsFail = true;
    await openSheet();
    fireEvent.click(screen.getByTestId('action-cancel'));
    const box = await screen.findByTestId('cancel-reasons-error');
    expect(box.textContent).toMatch(/couldn.t load the reasons/);
    reasonsFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByTestId('cancel-reason')).toHaveLength(3);
    expect(screen.queryByTestId('cancel-reasons-error')).toBeNull();
  });

  it('a date with its own picture says a new series picture does not replace it', async () => {
    event = { cover_image_url_override: 'https://example.com/halloween.jpg' };
    await openSheet();
    fireEvent.click(screen.getByTestId('action-media'));
    expect((await screen.findByTestId('date-own-picture')).textContent).toBe('Thu 8 Oct shows its own picture. A new series picture does not replace it.');
    expect(screen.getByTestId('date-save').textContent).toContain('Save the links');
  });

  it('inputs are 16px at every width, so phones do not zoom in on them', async () => {
    await openSheet();
    fireEvent.click(screen.getByTestId('action-time'));
    for (const id of ['date-start', 'date-end']) expect(document.getElementById(id)?.className).toMatch(/(^| )text-\[16px\] md:text-\[16px\]( |$)/);
  });
});
