import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

export const h = {
  rpc: vi.fn(),
  scopes: [{ city_id: 'c-bristol', city_name: 'Bristol', city_slug: 'bristol' }] as unknown[],
};

export function Page({ Component, path = '/ambassador' }: { Component: React.ComponentType; path?: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const Where = (): ReactNode => <span data-testid="where">{useLocation().pathname}</span>;
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes><Route path="/ambassador/*" element={<Component />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Answer the four RPCs the page may call. `list` is what admin_list_pending_review_v1 returns (offset 0). */
export function answer(opts: { list?: unknown[] | Error; pages?: Record<number, unknown[]>; decide?: (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown } }) {
  h.rpc.mockImplementation(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === 'admin_get_my_city_scopes') return { data: h.scopes, error: null };
    if (fn === 'admin_list_pending_review_v1') {
      if (opts.list instanceof Error) return { data: null, error: { message: opts.list.message } };
      const off = Number(args.p_offset ?? 0);
      return { data: opts.pages?.[off] ?? (off === 0 ? opts.list ?? [] : []), error: null };
    }
    if (fn === 'admin_approve_entity_v1' || fn === 'admin_reject_entity_v1') {
      const r = opts.decide?.(fn, args) ?? { data: { ok: true } };
      return { data: r.data ?? null, error: r.error ?? null };
    }
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  });
}
