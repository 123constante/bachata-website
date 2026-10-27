// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ONE_OFF, REASONS } from './cancelFixtures';

/*
 * Cancel the event through the REAL send path (shared/runCommands useSendOnce ->
 * selfServeApi runSeriesCommand -> envelope()): only supabase.rpc and the reasons read
 * are stood in for. The envelope targets the SERIES at the version the page showed;
 * a retry after a dropped connection carries the same idempotency key; Bring it back
 * is occurrence.cancel {cancelled:false} on the date through occurrence_command_p5.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => REASONS,
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

afterEach(cleanup);

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
        <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Cancel the event writes through the real envelope', () => {
  it('series_command_p5 {target: series, expected_version, cancel_one_off {reason}}; the retry reuses the key; Bring it back goes to the date', async () => {
    const series: Array<Record<string, unknown>> = [];
    const dates: Array<Record<string, unknown>> = [];
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'admin_event_workspace_p5') return { data: ONE_OFF.liveAhead, error: null };
      if (name === 'series_command_p5') {
        series.push(args.p_envelope as Record<string, unknown>);
        if (series.length === 1) throw new TypeError('Failed to fetch');
        return { data: { ok: true, new_version: 8, data: { already_cancelled: false, reason: 'Weather' } }, error: null };
      }
      if (name === 'occurrence_command_p5') {
        dates.push(args.p_envelope as Record<string, unknown>);
        return { data: { ok: true, new_version: 5 }, error: null };
      }
      return { data: null, error: null };
    });
    show();
    await waitFor(() => screen.getByTestId('p3-open-status'));
    fireEvent.click(screen.getByTestId('p3-open-status'));
    fireEvent.click(screen.getByTestId('p3-status-row-cancel'));
    await waitFor(() => screen.getByRole('button', { name: 'Weather' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-cancel-confirm')); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-cancel-confirm')); });
    await waitFor(() => screen.getByTestId('p3-undo'));
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({
      target_id: 'ser-1', expected_version: 7, idempotency_key: series[0].idempotency_key,
      command: { kind: 'series.cancel_one_off', payload: { reason: 'Weather' } },
    });
    expect(typeof series[0].idempotency_key).toBe('string');
    expect(series[1]).toEqual(series[0]);
    expect(screen.getByTestId('p3-undo').textContent).toBe('Bring it back');
    await act(async () => { fireEvent.click(screen.getByTestId('p3-undo')); });
    await waitFor(() => expect(dates).toHaveLength(1));
    expect(dates[0]).toEqual({
      target_id: 'o-2026-10-31', idempotency_key: dates[0].idempotency_key,
      command: { kind: 'occurrence.cancel', payload: { cancelled: false } },
    });
    expect(dates[0].idempotency_key).not.toBe(series[0].idempotency_key);
  });
});
