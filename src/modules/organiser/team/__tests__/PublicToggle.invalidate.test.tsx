// @vitest-environment jsdom
/** Public team visibility -> the public organiser page's team query ['organiser-lineup', id] is refreshed. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ set: vi.fn(), fetch: vi.fn() }));
vi.mock('../publicTeamApi', async () => ({
  ...(await vi.importActual<object>('../publicTeamApi')),
  setShownOnPublicTeam: h.set,
  fetchShownOnPublicTeam: h.fetch,
}));

import { PublicToggle } from '../PublicToggle';
import { PUBLIC_TEAM_FULL } from '../publicTeamApi';

const LINEUP = ['organiser-lineup', 'org1'];
async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(LINEUP, [{ id: 'x' }]);
  const spy = vi.spyOn(qc, 'invalidateQueries');
  render(<QueryClientProvider client={qc}><PublicToggle organiserId="org1" profileId="p1" /></QueryClientProvider>);
  const sw = await screen.findByTestId('team-public-switch');
  await waitFor(() => expect((sw as HTMLButtonElement).disabled).toBe(false));
  return { sw, spy };
}
const lineupCalls = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((c) => JSON.stringify((c[0] as { queryKey?: unknown })?.queryKey) === JSON.stringify(LINEUP));

afterEach(() => { cleanup(); h.set.mockReset(); h.fetch.mockReset(); });

describe('PublicToggle cache invalidation', () => {
  it('invalidates the public line-up when visibility changes', async () => {
    h.fetch.mockResolvedValue(false);
    h.set.mockResolvedValue('public');
    const { sw, spy } = await mount();
    fireEvent.click(sw);
    await waitFor(() => expect(lineupCalls(spy)).toHaveLength(1));
  });

  it('invalidates nothing when the team is full', async () => {
    h.fetch.mockResolvedValue(false);
    h.set.mockRejectedValue({ message: 'team_full' });
    const { sw, spy } = await mount();
    fireEvent.click(sw);
    await screen.findByTestId('team-public-error');
    expect(screen.getByTestId('team-public-error').textContent).toBe(PUBLIC_TEAM_FULL);
    expect(spy).not.toHaveBeenCalled();
  });

  it('invalidates nothing when the server reports unchanged', async () => {
    h.fetch.mockResolvedValue(true);
    h.set.mockResolvedValue('unchanged');
    const { sw, spy } = await mount();
    fireEvent.click(sw);
    await waitFor(() => expect(h.set).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(spy).not.toHaveBeenCalled();
  });
});
