// @vitest-environment jsdom
/**
 * search_public_v6 level filter (flags.searchV6). Covers: the flag-off path is
 * the unchanged v5 call/envelope, the v6 mapping (derived_level /
 * level_vote_count / unrated_event_count), chip -> p_level wiring, the
 * singular/plural unrated line, and the unrated null case. RPCs are mocked at
 * the client; the DB contract is proved in the admin repo (PR #616).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const flagState = vi.hoisted(() => ({ searchV5: true, searchV6: false }));
const rpc = vi.hoisted(() => vi.fn());

vi.mock('@/lib/featureFlags', () => ({ flags: flagState }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/festivalsList', () => ({
  fetchPublicFestivalsList: async () => [],
  filterUpcomingFestivals: (rows: unknown[]) => rows,
}));

import { useSearchResults } from '@/hooks/useSearchResults';
import { searchPublicV3 } from '@/lib/searchRpc';
import {
  LevelBadge, LevelFilterChips, UnratedLine, parseLevelParam, unratedLineText,
} from '@/components/search/LevelFilter';

const EVENT = { id: 'e1', name: 'Bachata Night', poster_url: null, city_slug: 'london', event_type: 'party', start_time: '2026-10-10T19:00:00Z' };
const envelope = (over: Record<string, unknown> = {}) => ({
  query: 'bachata', events: [EVENT], organisers: [], teachers: [], djs: [], dancers: [], venues: [],
  vendors: [], cities: [], total_count: 1, did_you_mean: null, ...over,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => {
  flagState.searchV5 = true;
  flagState.searchV6 = false;
  rpc.mockReset();
  rpc.mockResolvedValue({ data: envelope(), error: null });
});
afterEach(cleanup);

describe('flag OFF: unchanged v5 behaviour', () => {
  it('useSearchResults calls search_public_v5 with exactly the v5 args and returns the v5 envelope', async () => {
    const { result } = renderHook(() => useSearchResults('bachata', 'london', { levels: ['beginner'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('search_public_v5');
    expect(Object.keys(args).sort()).toEqual([
      'p_category', 'p_city_slug', 'p_date_from', 'p_date_to', 'p_event_type', 'p_format',
      'p_include_past', 'p_query', 'p_section_limit', 'p_styles',
    ]);
    expect(result.current.data).toStrictEqual(envelope());
    expect('unrated_event_count' in (result.current.data ?? {})).toBe(false);
  });

  it('searchPublicV3 calls v5 with the four original args and adds no level fields', async () => {
    const rows = await searchPublicV3('bachata', 'london', 12, false, ['beginner']);
    expect(rpc).toHaveBeenCalledWith('search_public_v5', {
      p_query: 'bachata', p_city_slug: 'london', p_section_limit: 12, p_include_past: false,
    });
    expect(rows[0]).not.toHaveProperty('derivedLevel');
    expect(rows[0]).not.toHaveProperty('levelVoteCount');
  });
});

describe('flag ON: v6 mapping', () => {
  beforeEach(() => { flagState.searchV6 = true; });

  it('useSearchResults calls search_public_v6, passes p_level and maps the level keys', async () => {
    rpc.mockResolvedValue({
      data: envelope({
        events: [{ ...EVENT, derived_level: 'improver', level_vote_count: 9 }, { ...EVENT, id: 'e2' }],
        unrated_event_count: 4,
      }),
      error: null,
    });
    const { result } = renderHook(() => useSearchResults('bachata', 'london', { levels: ['improver', 'advanced'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('search_public_v6');
    expect(args.p_level).toEqual(['improver', 'advanced']);
    expect(result.current.data?.events[0]).toMatchObject({ derived_level: 'improver', level_vote_count: 9 });
    expect(result.current.data?.events[1]).toMatchObject({ derived_level: null, level_vote_count: 0 });
    expect(result.current.data?.unrated_event_count).toBe(4);
  });

  it('sends p_level null when no level is selected and keeps unrated_event_count null', async () => {
    const { result } = renderHook(() => useSearchResults('bachata', null, { levels: [] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc.mock.calls[0][1].p_level).toBeNull();
    expect(result.current.data?.unrated_event_count).toBeNull();
  });

  it('searchPublicV3 calls v6 with p_level and maps derivedLevel / levelVoteCount', async () => {
    rpc.mockResolvedValue({ data: envelope({ events: [{ ...EVENT, derived_level: 'open_level', level_vote_count: 12 }] }), error: null });
    const rows = await searchPublicV3('bachata', 'london', 12, false, ['open_level']);
    expect(rpc).toHaveBeenCalledWith('search_public_v6', {
      p_query: 'bachata', p_city_slug: 'london', p_section_limit: 12, p_include_past: false, p_level: ['open_level'],
    });
    expect(rows[0]).toMatchObject({ derivedLevel: 'open_level', levelVoteCount: 12 });
  });
});

describe('level chips', () => {
  it('toggles levels into the selection (canonical order) and All levels clears', () => {
    const onChange = vi.fn();
    const { rerender } = render(<LevelFilterChips selected={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'All levels' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(onChange).toHaveBeenLastCalledWith(['advanced']);

    rerender(<LevelFilterChips selected={['advanced']} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Beginner' }));
    expect(onChange).toHaveBeenLastCalledWith(['beginner', 'advanced']);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole('button', { name: 'All levels' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('uses the rating hook labels, real buttons (keyboard reachable) and 44px targets', () => {
    render(<LevelFilterChips selected={[]} onChange={() => {}} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['All levels', 'Beginner', 'Improver', 'Intermediate', 'Advanced', 'Open level']);
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).toContain('min-h-[44px]');
      expect(b.className).toContain('focus-visible:ring-2');
    }
  });

  it('parseLevelParam -> p_level: keeps known levels only, deduped, canonical order', () => {
    expect(parseLevelParam(null)).toEqual([]);
    expect(parseLevelParam('advanced,bogus,beginner,advanced')).toEqual(['beginner', 'advanced']);
  });
});

describe('unrated line', () => {
  it('plural and singular wording', () => {
    expect(unratedLineText(5)).toBe('5 events not rated yet. Help rate them.');
    expect(unratedLineText(1)).toBe('1 event not rated yet. Help rate it.');
  });

  it('renders nothing for null / 0, or when no level is selected', () => {
    expect(unratedLineText(null)).toBeNull();
    expect(unratedLineText(0)).toBeNull();
    const { container, rerender } = render(<UnratedLine levelSelected count={null} />);
    expect(container.textContent).toBe('');
    rerender(<UnratedLine levelSelected={false} count={3} />);
    expect(container.textContent).toBe('');
    rerender(<UnratedLine levelSelected count={3} />);
    expect(container.textContent).toBe('3 events not rated yet. Help rate them.');
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('level badge', () => {
  it('shows the label only when derived_level is non-null', () => {
    const { container, rerender } = render(<LevelBadge level={null} />);
    expect(container.textContent).toBe('');
    rerender(<LevelBadge level="intermediate" />);
    expect(container.textContent).toBe('Intermediate');
  });
});
