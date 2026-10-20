import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import Done from '../../flows/Done';

export const ORG = 'org-1';
export const row = (user_id: string, member_role: string, extra: Record<string, unknown> = {}) => ({
  user_id, member_role, is_primary: member_role === 'owner', is_self: false, email: `${user_id}@x.example`, display_name: user_id, ...extra,
});
export const org = (role: 'owner' | 'manager') => ({
  id: ORG, name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role, latest_decision: null, series: [], team: [],
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}</p>;
}

/** Mounts `routes` at `path` with a Done route, so a flow can be followed to its Done screen. */
export function mountAt(path: string, routes: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes}
          <Route path="/account/o/done" element={<Done />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A supabase.rpc stub answering by function name; `calls(fn)` returns the args sent. */
export function makeRpc(answers: Record<string, unknown | ((args: Record<string, unknown>) => unknown)>) {
  const sent: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc = async (fn: string, args: Record<string, unknown> = {}) => {
    sent.push({ fn, args });
    const a = answers[fn];
    if (a === undefined) return { data: null, error: null };
    const data = typeof a === 'function' ? (a as (x: Record<string, unknown>) => unknown)(args) : a;
    if (data instanceof Error) return { data: null, error: { message: data.message } };
    return { data, error: null };
  };
  return { rpc, sent, calls: (fn: string) => sent.filter((s) => s.fn === fn).map((s) => s.args) };
}
