// @vitest-environment jsdom
/**
 * ER-FIX2-S6 (F-C9-3, F-C9-5, duplicates): with the rebuild switch ON for the
 * event, "What changes" no longer offers the old time / copy / Take this date
 * off steps (the date page owns time and copy; rule 9 removes Take off). OFF,
 * the flow is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, dateViewOf, homeOf, programmeOf, shapeByKey, upcomingOf, workspaceOf } from '../../../__tests__/shapes/shapes';
import { RebuildSwitchContext } from '@/modules/organiser/shell/rebuildSwitch';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import ChangeFlow from '../ChangeFlow';

const weekly = shapeByKey('live-weekly-until');
const date = upcomingOf(weekly)[0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: homeOf([weekly]), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspaceOf(weekly), error: null };
    if (fn === 'event_view_p5') return { data: dateViewOf(weekly, date), error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: programmeOf(weekly, date, true), error: null };
    return { data: null, error: null };
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function mount(rebuilt: boolean) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RebuildSwitchContext.Provider value={{ raw: rebuilt ? '*' : undefined, on: rebuilt, pending: false }}>
        <MemoryRouter initialEntries={[`/change/${weekly.id}/${date.id}`]}>
          <Routes><Route path="/change/:seriesId/:occurrenceId" element={<ChangeFlow step="what" />} /></Routes>
        </MemoryRouter>
      </RebuildSwitchContext.Provider>
    </QueryClientProvider>,
  );
}

describe('What changes on one date', () => {
  it.each([
    [true, ['change-lineup', 'change-venue', 'change-cancel'], ['change-time', 'change-copy', 'change-off']],
    [false, ['change-lineup', 'change-time', 'change-venue', 'change-copy', 'change-off', 'change-cancel'], []],
  ] as const)('switch on = %s', async (rebuilt, shown, hidden) => {
    mount(rebuilt);
    await screen.findByTestId('change-what');
    // The old rows wait for the event read (no flash): find them, then the set is final.
    for (const id of shown) expect(await screen.findByTestId(id), id).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
    for (const id of hidden) expect(screen.queryByTestId(id), id).toBeNull();
  });
});
