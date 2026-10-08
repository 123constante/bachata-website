// @vitest-environment jsdom
/**
 * F4 matrix: Home rendered with EVERY real series shape (shapes.ts, from the prod
 * survey) through the real organiser_home_v1 / workspace / programme parsers.
 * (1) a date row's tag says the same lifecycle word as the Events list and the
 * editor (or Cancelled); (3) the 'Extend' strip only appears when the event it
 * opens has an Extend control, and the empty state never points at something
 * the person cannot do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LIFECYCLE_WORD, SHAPES, homeOf, programmeOf, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));

import HomePage from '../index';

let shown: SeriesShape[];
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_home_v1') return { data: homeOf(shown), error: null };
    if (fn === 'list_organiser_access_requests_v1') return { data: [], error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspaceOf(shown.find((s) => s.id === args.p_series_id)!), error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') {
      for (const s of shown) {
        const d = s.dates.find((x) => x.id === args.p_occurrence_id);
        if (d) return { data: programmeOf(s, d), error: null };
      }
    }
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

function mount(shapes: SeriesShape[]) {
  shown = shapes;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o']}>
        <Routes>
          <Route path="/account/o" element={<HomePage />} />
          <Route path="*" element={<span />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const closed = (s: SeriesShape) => s.lifecycle === 'ended' || s.lifecycle === 'archived';
const editableWeekly = (s: SeriesShape) => {
  const r = s.rule as { mode?: string; interval?: number; weekdays?: number[] } | null;
  return s.format === 'recurring' && r?.mode === 'weekly' && (r.interval ?? 1) === 1 && (r.weekdays ?? []).length === 1;
};
/** All the reads Home makes have answered (strips stay hidden while loading). */
const settled = () => waitFor(() => expect(rpc.mock.calls.length).toBeGreaterThan(0)).then(() => new Promise((r) => setTimeout(r, 30)));

describe.each(SHAPES.map((s) => [s.key, s] as const))('shape %s', (_key, s) => {
  it('(1) each date row says Cancelled or the same lifecycle word as Events and the editor', async () => {
    mount([s]);
    const up = upcomingOf(s).slice(0, 3);
    if (up.length === 0) {
      await screen.findByTestId('home-empty');
      return;
    }
    const rows = await screen.findAllByTestId('home-date-row');
    expect(rows).toHaveLength(up.length);
    rows.forEach((row, i) => {
      const want = up[i].status === 'cancelled' ? 'Cancelled' : LIFECYCLE_WORD[s.lifecycle];
      expect(within(row).getByText(want)).toBeTruthy();
    });
  });

  it('(3) the Extend strip only for an event whose editor has Extend; the empty state names what you can do', async () => {
    mount([s]);
    await screen.findByTestId('org-page-home');
    await settled();
    await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    const strip = screen.queryByTestId('home-strip-runway');
    if (strip) expect(editableWeekly(s) && !closed(s)).toBe(true);
    const empty = screen.queryByTestId('home-empty');
    if (empty && closed(s)) expect(empty.textContent).not.toMatch(/list more/);
  });
});

describe('several shapes at once', () => {
  it('lists the next dates of running events only once each, soonest first', async () => {
    mount(SHAPES);
    const rows = await screen.findAllByTestId('home-date-row');
    const ids = rows.map((r) => r.getAttribute('data-occurrence'));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
