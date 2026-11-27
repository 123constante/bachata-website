// Site structure S4b-4c: server-rendered person links on /teachers and /vendors.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const state = vi.hoisted(() => ({ rpcResult: { data: null as unknown, error: null as unknown }, fail: false }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async () => {
      if (state.fail) throw new Error('boom');
      return state.rpcResult;
    },
  },
}));

import ServerPeopleList from '../app/components/ServerPeopleList';
import { loadTeacherRows, loadVendorRows } from '../app/lib/peopleListRows.trade';

describe('trade row loaders', () => {
  beforeEach(() => {
    state.fail = false;
  });
  it('maps the teacher rpc to {name, href}, honouring hide_surname', async () => {
    state.rpcResult = {
      data: [
        { entity_id: 't1', first_name: 'Ana', surname: 'Ruiz', hide_surname: false },
        { entity_id: 't2', first_name: 'Bo', surname: 'Li', hide_surname: true },
      ],
      error: null,
    };
    expect(await loadTeacherRows()).toEqual([
      { name: 'Ana Ruiz', href: '/teachers/t1' },
      { name: 'Bo', href: '/teachers/t2' },
    ]);
  });
  it('maps the vendor rpc to {name, href}', async () => {
    state.rpcResult = { data: [{ id: 'v1', business_name: 'Shoes Co' }, { id: 'v2', business_name: null }], error: null };
    expect(await loadVendorRows()).toEqual([
      { name: 'Shoes Co', href: '/vendors/v1' },
      { name: 'Untitled vendor', href: '/vendors/v2' },
    ]);
  });
  it('returns [] on error', async () => {
    state.rpcResult = { data: null, error: { message: 'x' } };
    expect(await loadTeacherRows()).toEqual([]);
    expect(await loadVendorRows()).toEqual([]);
    state.fail = true;
    expect(await loadTeacherRows()).toEqual([]);
    expect(await loadVendorRows()).toEqual([]);
  });
});

describe('ServerPeopleList for trade pages', () => {
  it('renders one link per row', () => {
    const html = renderToStaticMarkup(
      createElement(ServerPeopleList, {
        heading: 'Bachata vendors',
        rows: [{ name: 'A', href: '/vendors/1' }, { name: 'B', href: '/vendors/2' }],
      }),
    );
    expect(html.match(/<a href="\/vendors\/\d"/g)).toHaveLength(2);
  });
});

describe('route modules', () => {
  it.each(['teachers', 'vendors'])('list.%s exports loader + headers', async (k) => {
    const mod = await import(`../app/routes/list.${k}.tsx`);
    expect(typeof mod.loader).toBe('function');
    expect(typeof mod.headers).toBe('function');
  });
});
