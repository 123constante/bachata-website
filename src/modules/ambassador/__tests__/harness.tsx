import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

import { NOW } from './fixtures';

/** The pinned clock for every matrix test: fixtures' "N days ago" and the page's London day count agree. */
export function pinNow() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
}

export const USER_ID = 'u-jan';
export const BRISTOL = { id: 'c-bristol', name: 'Bristol', slug: 'bristol' };
export const BATH = { id: 'c-bath', name: 'Bath', slug: 'bath' };

/** A recorded `.from(table)` read: the filters the page applied. */
export interface TableRead { table: string; select: string; eq: Record<string, unknown>; in: Record<string, unknown[]> }

export const h = {
  rpc: vi.fn(),
  /** The user's `entity_members` rows (the page asks for city ambassador rows only). */
  members: [{ entity_id: BRISTOL.id }] as { entity_id: string }[],
  membersError: null as unknown,
  cities: [BRISTOL, BATH],
  reads: [] as TableRead[],
};

/** A minimal PostgREST builder: chainable select / eq / in, awaited for `{ data, error }`. */
export function from(table: string) {
  const read: TableRead = { table, select: '', eq: {}, in: {} };
  h.reads.push(read);
  const result = () => {
    if (table === 'entity_members') return h.membersError ? { data: null, error: h.membersError } : { data: h.members, error: null };
    if (table === 'cities') return { data: h.cities.filter((c) => (read.in.id ?? []).includes(c.id)), error: null };
    return { data: null, error: { message: `unexpected table ${table}` } };
  };
  const b = {
    select: (cols: string) => ((read.select = cols), b),
    eq: (col: string, v: unknown) => ((read.eq[col] = v), b),
    in: (col: string, v: unknown[]) => ((read.in[col] = v), b),
    then: (ok: (r: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad),
  };
  return b;
}

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

/** Answer the three RPCs the page may call. `list` is what admin_list_pending_review_v1 returns (offset 0); a function answers per city. */
export function answer(opts: {
  list?: unknown[] | Error | ((cityId: string, offset: number) => unknown[] | Error);
  pages?: Record<number, unknown[]>;
  decide?: (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown };
}) {
  h.rpc.mockImplementation(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === 'admin_list_pending_review_v1') {
      const off = Number(args.p_offset ?? 0);
      const list = typeof opts.list === 'function' ? opts.list(String(args.p_city_id), off) : opts.list;
      if (list instanceof Error) return { data: null, error: { message: list.message } };
      return { data: opts.pages?.[off] ?? (off === 0 ? list ?? [] : []), error: null };
    }
    if (fn === 'admin_approve_entity_v1' || fn === 'admin_reject_entity_v1') {
      const r = opts.decide?.(fn, args) ?? { data: { ok: true } };
      return { data: r.data ?? null, error: r.error ?? null };
    }
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  });
}
