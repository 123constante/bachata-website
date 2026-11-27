// Site structure S4b-4b: server-rendered links on /organisers and /venues.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const state = vi.hoisted(() => ({ orgs: [] as unknown[], venues: [] as unknown[], fail: false }));

vi.mock('@/lib/organiserDirectoryList', () => ({
  fetchDirectoryOrganisers: async () => {
    if (state.fail) throw new Error('boom');
    return state.orgs;
  },
}));
vi.mock('@/services/venuePublicService', () => ({
  fetchPublicVenuesList: async () => {
    if (state.fail) throw new Error('boom');
    return state.venues;
  },
}));

import ServerPeopleList from '../app/components/ServerPeopleList';
import { loadOrganiserRows, loadVenueRows } from '../app/lib/peopleListRows.places';

describe('places row loaders', () => {
  beforeEach(() => {
    state.fail = false;
  });
  it('maps organisers to {name, href} (slug, else id)', async () => {
    state.orgs = [
      { id: 'o1', slug: 'alpha', name: 'Alpha' },
      { id: 'o2', slug: null, name: 'Beta' },
    ];
    expect(await loadOrganiserRows()).toEqual([
      { name: 'Alpha', href: '/organisers/alpha' },
      { name: 'Beta', href: '/organisers/o2' },
    ]);
  });
  it('maps venues to {name, href} (slug, else id)', async () => {
    state.venues = [
      { id: 'v1', slug: 'club', name: 'Club' },
      { id: 'v2', slug: null, name: 'Hall' },
    ];
    expect(await loadVenueRows()).toEqual([
      { name: 'Club', href: '/venue-entity/club' },
      { name: 'Hall', href: '/venue-entity/v2' },
    ]);
  });
  it('returns [] on error', async () => {
    state.fail = true;
    expect(await loadOrganiserRows()).toEqual([]);
    expect(await loadVenueRows()).toEqual([]);
  });
});

describe('server render', () => {
  it('shows one link per row', () => {
    const html = renderToStaticMarkup(
      createElement(ServerPeopleList, {
        heading: 'Bachata venues in London',
        rows: [{ name: 'Club', href: '/venue-entity/club' }],
      }),
    );
    expect(html).toContain('<a href="/venue-entity/club">Club</a>');
  });
});

describe('route modules', () => {
  it.each(['organisers', 'venues'])('list.%s exports loader + headers', async (k) => {
    const mod = await import(`../app/routes/list.${k}.tsx`);
    expect(typeof mod.loader).toBe('function');
    expect(typeof mod.headers).toBe('function');
  });
});
