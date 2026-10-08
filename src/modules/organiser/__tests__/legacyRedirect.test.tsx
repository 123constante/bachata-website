// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter, useLocation } from 'react-router-dom';
import { LegacyAccountRedirect } from '../shell/LegacyRedirect';
import { legacyAccountPath } from '../shell/legacyPaths';

afterEach(cleanup);

function Where() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="where">{`${pathname}${search}${hash}`}</p>;
}

// The same four routes AnimatedRoutes mounts behind flags.organiserSelfServe.
function at(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/account" element={<LegacyAccountRedirect target="home" />} />
        <Route path="/account/new" element={<LegacyAccountRedirect target="new" />} />
        <Route path="/account/series/:seriesId" element={<LegacyAccountRedirect target="series" />} />
        <Route path="/account/team/:organiserId?" element={<LegacyAccountRedirect target="team" />} />
        <Route path="/account/o/*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('old /account URLs land on the rebuilt area', () => {
  it.each([
    ['/account', '/account/o'],
    ['/account?claim=1#top', '/account/o?claim=1#top'],
    ['/account/new', '/account/o/events/new'],
    ['/account/new?organiser=org-1', '/account/o/events/new?organiser=org-1'],
    ['/account/series/ser-1', '/account/o/events/ser-1'],
    ['/account/series/ser-1?x=2#dates', '/account/o/events/ser-1?x=2#dates'],
    ['/account/team', '/account/o/team'],
    ['/account/team/org-1', '/account/o/team?o=org-1'],
    ['/account/team/org-1?o=org-2', '/account/o/team?o=org-2'],
  ])('%s -> %s', async (from, to) => {
    at(from);
    expect((await screen.findByTestId('where')).textContent).toBe(to);
  });

  it('replaces the history entry, so Back never bounces into the redirect', async () => {
    const router = createMemoryRouter(
      [
        { path: '/account', element: <LegacyAccountRedirect target="home" /> },
        { path: '/account/o/*', element: <Where /> },
      ],
      { initialEntries: ['/account'] },
    );
    render(<RouterProvider router={router} />);
    expect((await screen.findByTestId('where')).textContent).toBe('/account/o');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('encodes the series id', () => {
    expect(legacyAccountPath('series', { seriesId: 'a b' }, '', '')).toBe('/account/o/events/a%20b');
  });
});
