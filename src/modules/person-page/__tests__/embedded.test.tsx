// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmbeddedProfileContext } from '@/lib/embeddedProfile';
import { AlsoRoles } from '../AlsoRoles';
import { DjHero } from '@/components/dj/DjTiles';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';

const roles = vi.fn();
vi.mock('../badges', async (orig) => {
  const real = await orig<typeof import('../badges')>();
  return { ...real, usePeopleBadges: (ids: string[]) => ({ badges: ids.length ? new Map([['p1', { id: 'p1', roles: roles(), djName: null, djHasUpcoming: false, nextGigDate: null }]]) : new Map(), isLoading: false }) };
});
afterEach(cleanup);

const row = (current: 'teacher' | 'dj' | 'dancer', embedded = false) =>
  render(
    <MemoryRouter>
      <EmbeddedProfileContext.Provider value={embedded}>
        <AlsoRoles current={current} id="p1" slug="ana-g" />
      </EmbeddedProfileContext.Provider>
    </MemoryRouter>,
  );

describe('AlsoRoles on the old pages (teacher flag off)', () => {
  it.each([
    ['dj', ['teacher', 'dj', 'dancer'], [['Dancer', '/dancers/p1']], ['Teacher']],
    ['dancer', ['teacher', 'dj', 'dancer'], [['DJ', '/djs/p1']], ['Teacher']],
    ['dancer', ['teacher', 'dancer'], [], ['Teacher']],
  ] as const)('%s page of %j: linked chips %j, plain %j', (current, has, links, plain) => {
    roles.mockReturnValue(has);
    row(current);
    for (const [name, href] of links) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
    expect(screen.queryAllByRole('link')).toHaveLength(links.length);
    for (const name of plain) expect(screen.getByText(name).closest('a')).toBeNull();
  });

  it('a one-role person gets no bar', () => {
    roles.mockReturnValue(['teacher']);
    row('teacher');
    expect(screen.queryByTestId('also-bar')).toBeNull();
  });

  it('no bar inside a tab (the tab bar is the navigation)', () => {
    roles.mockReturnValue(['teacher', 'dj']);
    row('teacher', true);
    expect(screen.queryByTestId('also-bar')).toBeNull();
  });
});

describe('DjHero embedded', () => {
  const props = { name: 'DJ Ana', photoUrl: null, cityName: 'London', nationality: null, bio: 'Plays sensual', isLive: false, stats: { gigs: 3, upcoming: 1, genres: 2 } };
  it('standalone keeps the name h1; embedded drops identity but keeps bio and stats', () => {
    installJsdomPolyfills();
    render(<DjHero {...props} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('DJ Ana');
    cleanup();
    render(<EmbeddedProfileContext.Provider value={true}><DjHero {...props} /></EmbeddedProfileContext.Provider>);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('Plays sensual')).toBeTruthy();
    expect(screen.getByText('Gigs')).toBeTruthy();
  });
});
