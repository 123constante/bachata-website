// @vitest-environment jsdom
/**
 * The public /videographers page must never read private videographers
 * columns: the admin repo revokes SELECT on them from anon/authenticated, and
 * `*` expands to them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VIDEOGRAPHER_PUBLIC_COLS } from '@/lib/videographerPublicCols';

const selectSpy = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  chain.select = (...args: unknown[]) => { selectSpy(...args); return chain; };
  chain.eq = () => chain;
  chain.order = () => Promise.resolve({ data: [], error: null });
  return { supabase: { from: () => chain } };
});
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/seo', () => ({ useSeo: () => {}, buildSeoForRoute: () => ({}) }));

import Videographers from '../Videographers';

const PRIVATE = ['email', 'phone', 'whatsapp', 'created_by', 'claimed_by', 'meta_data'];

afterEach(() => { cleanup(); selectSpy.mockReset(); });

describe('videographers public columns', () => {
  const cols = VIDEOGRAPHER_PUBLIC_COLS.split(',').map((c) => c.trim());

  it.each(PRIVATE)('constant does not contain %s', (priv) => {
    expect(cols).not.toContain(priv);
  });

  it('constant is never a wildcard', () => {
    expect(cols).not.toContain('*');
  });

  it('page query selects exactly the constant', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><Videographers /></MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(selectSpy).toHaveBeenCalled());
    expect(selectSpy.mock.calls[0][0]).toBe(VIDEOGRAPHER_PUBLIC_COLS);
  });
});
