// Site structure S4b-4a: server-rendered person links on /dancers and /djs.
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
    from: () => {
      throw new Error('boom');
    },
  },
}));

import ServerPeopleList from '../app/components/ServerPeopleList';
import { loadDjRows, loadDancerRows } from '../app/lib/peopleListRows';

describe('ServerPeopleList', () => {
  it('renders h1 and one link per row', () => {
    const html = renderToStaticMarkup(
      createElement(ServerPeopleList, {
        heading: 'Bachata DJs in London',
        rows: [
          { name: 'A', href: '/djs/1' },
          { name: 'B', href: '/djs/2' },
        ],
      }),
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Bachata DJs in London');
    expect(html.match(/<a href="\/djs\/\d"/g)).toHaveLength(2);
  });
  it('renders the empty line', () => {
    const html = renderToStaticMarkup(createElement(ServerPeopleList, { heading: 'H', rows: [] }));
    expect(html).toContain('No profiles listed yet.');
    expect(html).not.toContain('<ul');
  });
});

describe('peopleListRows', () => {
  beforeEach(() => {
    state.fail = false;
  });
  it('maps the DJ rpc to {name, href}', async () => {
    state.rpcResult = { data: [{ id: 'abc', dj_name: 'DJ Z', display_name: 'DJ Z' }], error: null };
    expect(await loadDjRows()).toEqual([{ name: 'DJ Z', href: '/djs/abc' }]);
  });
  it('returns [] on error', async () => {
    state.rpcResult = { data: null, error: { message: 'x' } };
    expect(await loadDjRows()).toEqual([]);
    state.fail = true;
    expect(await loadDjRows()).toEqual([]);
    expect(await loadDancerRows()).toEqual([]);
  });
});

describe('route modules', () => {
  it.each(['dancers', 'djs'])('list.%s exports loader + headers', async (k) => {
    const mod = await import(`../app/routes/list.${k}.tsx`);
    expect(typeof mod.loader).toBe('function');
    expect(typeof mod.headers).toBe('function');
  });
});
