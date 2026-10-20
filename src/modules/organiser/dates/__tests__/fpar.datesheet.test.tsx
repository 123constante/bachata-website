// @vitest-environment jsdom
/**
 * F-PAR on the date page (PAR-B S5, S6, N1): the put-back button says the one
 * name PUT_IT_BACK, the take-off view shows the one TAKE_OFF body and undo
 * line, and the line-up section is headed "Sessions" (its rows say Sessions).
 * Real prod shapes (shapes.ts) through the real parsers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, VENUES, dateViewOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape, type ShapeDate } from '../../__tests__/shapes/shapes';
import { PUT_IT_BACK, TAKE_OFF } from '@/modules/organiser/shared/copy';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

let s: SeriesShape;
let d: ShapeDate;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: programmeOf(s, d, true), error: null };
    if (fn === 'event_view_p5') return { data: dateViewOf(s, d), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspaceOf(s), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function open(shape: SeriesShape, date: ShapeDate) {
  s = shape;
  d = date;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${s.id}/dates/${d.id}`]}>
        <Routes><Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByTestId('date-header');
  await waitFor(() => expect(screen.getByTestId('date-span').textContent).toContain(s.name));
}

const live = shapeByKey('live-weekly-until');
const openRun = shapeByKey('live-weekly-open');

describe('F-PAR on the date page', () => {
  it('S5: a cancelled date is put back with the one name, PUT_IT_BACK', async () => {
    await open(openRun, upcomingOf(openRun).find((x) => x.status === 'cancelled')!);
    fireEvent.click(await screen.findByTestId('date-uncancel'));
    expect((await screen.findByTestId('date-uncancel-confirm')).textContent).toBe(PUT_IT_BACK);
  });

  it('S6: Take this date off shows the one TAKE_OFF body, then its undo line', async () => {
    await open(live, upcomingOf(live).find((x) => x.status === 'scheduled')!);
    fireEvent.click(await screen.findByTestId('date-break'));
    const view = await screen.findByTestId('date-break-view');
    expect(view.textContent).toContain(TAKE_OFF.body);
    expect(screen.getByTestId('date-break-undo').textContent).toBe(TAKE_OFF.undo);
  });

  it('N1: the line-up section is headed "Sessions", never "Schedule"', async () => {
    await open(live, upcomingOf(live).find((x) => x.status === 'scheduled')!);
    expect(document.getElementById('schedule-label')?.textContent).toBe('Sessions');
  });
});
