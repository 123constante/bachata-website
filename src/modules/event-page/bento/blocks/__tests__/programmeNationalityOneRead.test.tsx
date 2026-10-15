// @vitest-environment jsdom
/**
 * Programme nationality flags ride on the programme read (2026-10-13).
 *
 * event_view_p5 legacy_compat emits `nationality_code` (two letters or null) on
 * every person of the programme (admin #774/#799; prod 2026-10-13: 213 of 213
 * person objects carry the key). The real ScheduleBlock, fed that payload by a
 * fake supabase, must show the sticker from it and must NOT make the old second
 * request (dancer_profiles.nationality for the people on the programme).
 *
 * Shapes, per person: a code, null, and a payload from before the key existed
 * (no key at all) -- the last two show no flag and still cost no request.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const calls = vi.hoisted(() => ({ rpc: [] as string[], from: [] as string[], items: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'or', 'is', 'order', 'limit']) chain[m] = () => chain;
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  return {
    supabase: {
      rpc: (name: string) => {
        calls.rpc.push(name);
        return Promise.resolve({ data: name === 'event_view_p5' ? calls.items : null, error: null });
      },
      from: (table: string) => {
        calls.from.push(table);
        return chain;
      },
    },
  };
});

import { ScheduleBlock } from '../ScheduleBlock';

const person = (id: string, name: string, extra: Record<string, unknown>) => ({
  profile_id: id, profile_type: 'teacher', display_name: name, avatar_url: 'https://cdn.example/p.jpg', sort_order: 1, level: null, ...extra,
});
const item = (people: unknown[]) => ({
  id: 'i1', title: 'Bachata class', type: 'class', start_time: '2026-10-20T19:00:00', end_time: '2026-10-20T20:00:00',
  sort_order: 1, levels: [], room: null, section_id: null, section_kind: null, section_label: null, people,
});

const SHAPES = [
  { key: 'code ES', extra: { nationality_code: 'ES' }, flag: 'ES' },
  { key: 'code null', extra: { nationality_code: null }, flag: null },
  { key: 'key absent (pre-#774 payload)', extra: {}, flag: null },
] as const;

afterEach(() => {
  cleanup();
  calls.rpc = [];
  calls.from = [];
});

describe.each(SHAPES)('programme person with $key', (shape) => {
  it('flag comes from the programme read; no dancer_profiles request', async () => {
    calls.items = [item([person('p-1', 'Lucia Moreno', shape.extra)])];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ScheduleBlock eventId="evt-1" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.textContent).toContain('Lucia'));
    if (shape.flag) {
      await waitFor(() => expect(container.querySelector(`[data-nationality-flag="${shape.flag}"]`)).not.toBeNull());
    } else {
      // Let the lazy flag chunk settle; it must stay absent.
      await new Promise((r) => setTimeout(r, 50));
      expect(container.querySelector('[data-nationality-flag]')).toBeNull();
    }
    expect(calls.from).not.toContain('dancer_profiles');
    expect(calls.rpc.filter((n) => n === 'event_view_p5')).toHaveLength(1);
  });
});
