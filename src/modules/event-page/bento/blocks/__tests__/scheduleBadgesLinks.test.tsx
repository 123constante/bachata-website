// @vitest-environment jsdom
/**
 * W1 review C6 + the S3 mutant gap: the REAL ScheduleBlock, fed a programme with a teacher,
 * a DJ and a dancer, must never render a /teachers/ link while the teacher pages are closed,
 * whatever the people-badges read does (answers, errors, or is still loading). On a badges
 * error a DJ/dancer keeps the feed's own link (their pages exist); a teacher has none.
 *
 * Mutant this must catch (review section 8): ScheduleBlock ignoring the badges mapping
 * (`people: s.people`) leaves the feed's /teachers/ href on the chip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

type BadgesAnswer = { data: unknown; error: { message: string } | null } | 'pending';
const h = vi.hoisted(() => ({ items: [] as unknown[], badges: { data: [], error: null } as unknown }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, teacherDetail: false } };
});
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'or', 'is', 'order', 'limit']) chain[m] = () => chain;
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  return {
    supabase: {
      rpc: (name: string) => {
        if (name === 'event_view_p5') return Promise.resolve({ data: h.items, error: null });
        if (name === 'get_public_people_badges_v1') {
          return h.badges === 'pending' ? new Promise(() => {}) : Promise.resolve(h.badges);
        }
        return Promise.resolve({ data: null, error: null });
      },
      from: () => chain,
    },
  };
});

import { ScheduleBlock } from '../ScheduleBlock';

const person = (id: string, type: string, name: string) => ({
  profile_id: id, profile_type: type, display_name: name, avatar_url: null, sort_order: 1, level: null, nationality_code: null,
});
const item = (id: string, people: unknown[]) => ({
  id, title: 'Bachata class', type: 'class', start_time: '2026-10-20T19:00:00', end_time: '2026-10-20T20:00:00',
  sort_order: 1, levels: [], room: null, section_id: null, section_kind: null, section_label: null, people,
});
const PROGRAMME = [
  item('i1', [person('t-1', 'teacher', 'Lucia Teacher')]),
  item('i2', [person('dj-1', 'dj', 'Kiko Spin')]),
  item('i3', [person('d-1', 'dancer', 'Ana Dancer')]),
];
const badge = (id: string, roles: string[], dj_name: string | null = null) => ({ id, roles, dj_name, next_gig_date: null, dj_has_upcoming: false });

const CASES: Array<{ name: string; badges: BadgesAnswer; want: Record<string, string | null> }> = [
  {
    name: 'badges read errors: DJ/dancer keep the feed link, teacher has none',
    badges: { data: null, error: { message: 'boom' } },
    want: { 't-1': null, 'dj-1': '/djs/dj-1', 'd-1': '/dancers/d-1' },
  },
  {
    name: 'badges answer: teacher-only plain, teacher who dances links the dancer page',
    badges: { data: [badge('t-1', ['teacher', 'dancer']), badge('dj-1', ['dj']), badge('d-1', ['dancer'])], error: null },
    want: { 't-1': '/dancers/t-1', 'dj-1': '/djs/dj-1', 'd-1': '/dancers/d-1' },
  },
  {
    name: 'badges answer: teacher-only member has no link',
    badges: { data: [badge('t-1', ['teacher']), badge('dj-1', ['dj', 'teacher']), badge('d-1', ['dancer'])], error: null },
    want: { 't-1': null, 'dj-1': '/djs/dj-1', 'd-1': '/dancers/d-1' },
  },
  {
    name: 'badges still loading: teacher has no link',
    badges: 'pending',
    want: { 't-1': null, 'dj-1': '/djs/dj-1', 'd-1': '/dancers/d-1' },
  },
];

afterEach(cleanup);

describe.each(CASES)('ScheduleBlock, teacher pages closed: $name', ({ badges, want }) => {
  it('no /teachers/ href anywhere; each chip links where the mapping says', async () => {
    h.items = PROGRAMME;
    h.badges = badges;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ScheduleBlock eventId="evt-1" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.querySelector('[data-person-id="t-1"]')).not.toBeNull());
    // Assert on the SETTLED badges read (answered or errored), not the loading window.
    if (badges !== 'pending') {
      await waitFor(() => {
        // The key with ids (the empty-ids key before the programme arrives stays disabled).
        const qs = qc.getQueryCache().findAll({ queryKey: ['people-badges'] })
          .filter((q) => (q.queryKey[1] as string[]).length > 0);
        expect(qs.length).toBeGreaterThan(0);
        for (const q of qs) expect(q.state.status).not.toBe('pending');
      });
    }
    await waitFor(() => {
      for (const [id, href] of Object.entries(want)) {
        const chips = Array.from(container.querySelectorAll(`[data-person-id="${id}"]`));
        expect(chips.length).toBeGreaterThan(0);
        for (const c of chips) expect(c.getAttribute('href')).toBe(href);
      }
    });
    expect(container.innerHTML).not.toContain('/teachers/');
  });
});
