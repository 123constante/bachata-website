import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ACCEPTANCE E12 (docs/organiser-page/ACCEPTANCE.md): the Past nights window is
// ONE truth, computed in fetchOrganiserPastOccEvents and passed explicitly, so
// the server default (730 d) can never be the window the page actually reads.
// This pins the numbers; a change here is a product decision, not a refactor.

const calls = vi.hoisted(() => [] as Array<{ fn: string; args: Record<string, unknown> }>);

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: [], error: null };
    },
  },
}));

import { fetchOrganiserFutureOccEvents, fetchOrganiserPastOccEvents } from '../organiserPublicProfile';

const NOW = new Date('2026-11-05T12:00:00Z');
const DAY = 86400000;

beforeEach(() => {
  calls.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('E12 past window is one explicit truth', () => {
  it('past feed: from = today - 3650 days, to = tomorrow, include_past, all passed explicitly', async () => {
    await fetchOrganiserPastOccEvents('org-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('get_organiser_calendar_events_v1');
    expect(calls[0].args).toEqual({
      p_organiser_id: 'org-1',
      p_from: new Date(NOW.getTime() - 3650 * DAY).toISOString().slice(0, 10),
      p_to: new Date(NOW.getTime() + DAY).toISOString().slice(0, 10),
      p_include_past: true,
    });
  });

  it('the window is wider than the server default of 730 days (never the server default)', async () => {
    await fetchOrganiserPastOccEvents('org-1');
    const from = Date.parse(String(calls[0].args.p_from));
    expect(NOW.getTime() - from).toBeGreaterThan(730 * DAY);
  });

  it('upcoming feed passes no window arguments (the server default horizon applies there)', async () => {
    await fetchOrganiserFutureOccEvents('org-1');
    expect(calls[0].args).toEqual({ p_organiser_id: 'org-1' });
  });
});
