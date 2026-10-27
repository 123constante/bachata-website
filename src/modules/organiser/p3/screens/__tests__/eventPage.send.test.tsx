// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES } from './wsFixtures';

/*
 * The Status sheet through the REAL R1 send path (shared/runCommands useRunCommands ->
 * selfServeApi runSeriesCommand -> envelope()): only supabase.rpc is stood in for.
 * Each write carries a fresh idempotency key and the version the page showed.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
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

describe('Status sheet writes through the real envelope', () => {
  it('Hide then Undo: two series_command_p5 calls, fresh keys, expected_version from the page then from the reply', async () => {
    const envs: Array<Record<string, unknown>> = [];
    rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'admin_event_workspace_p5') return { data: SHAPES.weekly, error: null };
      if (name === 'series_command_p5') {
        envs.push(args.p_envelope as Record<string, unknown>);
        return { data: { ok: true, new_version: 7 + envs.length }, error: null };
      }
      return { data: null, error: null };
    });
    show();
    await waitFor(() => screen.getByTestId('p3-open-status'));
    expect(rpc).toHaveBeenCalledWith('admin_event_workspace_p5', { p_series_id: 'ser-1' });
    fireEvent.click(screen.getByTestId('p3-open-status'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-status-row-hide')); });
    await waitFor(() => screen.getByTestId('p3-undo'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-undo')); });
    await waitFor(() => expect(envs).toHaveLength(2));
    expect(envs[0]).toMatchObject({ target_id: 'ser-1', expected_version: 7, command: { kind: 'series.set_lifecycle', payload: { to: 'paused' } } });
    expect(envs[1]).toMatchObject({ target_id: 'ser-1', expected_version: 8, command: { kind: 'series.set_lifecycle', payload: { to: 'live' } } });
    expect(typeof envs[0].idempotency_key).toBe('string');
    expect(envs[0].idempotency_key).not.toBe(envs[1].idempotency_key);
  });

  it('a refusal from the server shows COMMAND_COPY words, never its text', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'admin_event_workspace_p5') return { data: SHAPES.weekly, error: null };
      return { data: null, error: { message: 'invalid_transition: series ser-1 has no night this platform can evidence, so there is no date', code: 'P0001' } };
    });
    show();
    await waitFor(() => screen.getByTestId('p3-open-status'));
    fireEvent.click(screen.getByTestId('p3-open-status'));
    fireEvent.click(screen.getByTestId('p3-status-row-end'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-end-confirm')); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).toMatch(/^We have no record of a night this event ran/);
    expect(document.body.textContent).not.toMatch(/invalid_transition/);
  });
});
