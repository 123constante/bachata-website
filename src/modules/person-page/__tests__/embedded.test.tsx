// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmbeddedProfileContext } from '@/lib/embeddedProfile';
import { AlsoRoles } from '../AlsoRoles';
import { DjHero } from '@/components/dj/DjTiles';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';

const roles = vi.fn();
vi.mock('../usePersonRoles', () => ({ usePersonRoles: (id: string | undefined) => (id ? roles() : []) }));
afterEach(cleanup);

const row = (current: 'teacher' | 'dj' | 'dancer', embedded = false) =>
  render(
    <MemoryRouter>
      <EmbeddedProfileContext.Provider value={embedded}>
        <AlsoRoles current={current} id="p1" slug="ana-g" />
      </EmbeddedProfileContext.Provider>
    </MemoryRouter>,
  );

describe('AlsoRoles on the old pages', () => {
  it.each([
    ['teacher', ['teacher', 'dj', 'dancer'], [['DJ', '/people/ana-g#dj'], ['Dancer', '/people/ana-g#dancing']]],
    ['dj', ['teacher', 'dj', 'dancer'], [['Teacher', '/people/ana-g#teaching'], ['Dancer', '/people/ana-g#dancing']]],
    ['dancer', ['teacher', 'dancer'], [['Teacher', '/people/ana-g#teaching']]],
  ] as const)('%s page of %j links the other roles', (current, has, links) => {
    roles.mockReturnValue(has);
    row(current);
    for (const [name, href] of links) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
    }
    expect(screen.getAllByRole('link')).toHaveLength(links.length);
    expect(screen.getByText('Also:')).toBeTruthy();
  });

  it('a one-role person gets no row', () => {
    roles.mockReturnValue(['teacher']);
    row('teacher');
    expect(screen.queryByText('Also:')).toBeNull();
  });

  it('no row inside a tab (the tab bar is the navigation)', () => {
    roles.mockReturnValue(['teacher', 'dj']);
    row('teacher', true);
    expect(screen.queryByText('Also:')).toBeNull();
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
