// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import * as fromEvents from '@/modules/organiser/events/eventsApi';
import { useEventWorkspace, useRunCommands } from '../runCommands';
import { lifecycleCommand } from '../seriesCommands';

const wrapper = (client: QueryClient) => ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeEach(() => rpc.mockReset());

describe('shared/runCommands (4.3 #11)', () => {
  it('events/eventsApi re-exports the same two functions', () => {
    expect(fromEvents.useRunCommands).toBe(useRunCommands);
    expect(fromEvents.useEventWorkspace).toBe(useEventWorkspace);
  });

  it('useRunCommands chains each command on the version the previous one returned', async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, new_version: 8 }, error: null }).mockResolvedValueOnce({ data: { ok: true, new_version: 9 }, error: null });
    const client = new QueryClient();
    const { result } = renderHook(() => useRunCommands('s1'), { wrapper: wrapper(client) });
    const v = await result.current([lifecycleCommand('paused'), lifecycleCommand('live')], 7);
    expect(v).toBe(9);
    expect(rpc.mock.calls.map((c) => [c[0], (c[1] as { p_envelope: { expected_version: number } }).p_envelope.expected_version])).toEqual([
      ['series_command_p5', 7],
      ['series_command_p5', 8],
    ]);
  });

  it('useEventWorkspace reads admin_event_workspace_p5 for the series', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useEventWorkspace('s9'), { wrapper: wrapper(client) });
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('admin_event_workspace_p5', { p_series_id: 's9' }));
  });
});
