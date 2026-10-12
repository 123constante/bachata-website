// @vitest-environment jsdom
/**
 * ScrollToTop: one reset to the top per pathname change, made in the SAME commit
 * as the new page (before the browser can paint it), never on a #hash URL, and
 * never on a query-only change. The browser half of this (real scrollY sampled
 * across real route pairs) is tests/e2e-phone/scroll-reset.phone.spec.ts.
 *
 * "Same commit" is checked the way the page sees it: the new route's own LAYOUT
 * effect records whether the reset has already happened. The harness mirrors
 * app/root.tsx -- <ScrollToTop/> renders before the route outlet -- so a layout
 * effect in ScrollToTop has run by then, and a passive one (the bug: the new page
 * painted at the old scrollY) has not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';
import { ScrollToTop } from '../ScrollToTop';

let scrollTo: ReturnType<typeof vi.fn>;
let resetsSeenAtCommit: Record<string, number>;

// Keyed on the pathname, not the route: organiser -> organiser keeps this
// component mounted and only changes the pathname.
const Page = ({ name }: { name: string }) => {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    resetsSeenAtCommit[pathname] = scrollTo.mock.calls.length;
  }, [pathname]);
  return <h1>{name}</h1>;
};

const Shell = () => (
  <>
    <ScrollToTop />
    <main>
      <Outlet />
    </main>
  </>
);

const PATHS = ['/faq', '/organisers', '/organisers/ritmo', '/organisers/salsa', '/event/abc', '/city/london-gb'];

function mount(initial: string) {
  const router = createMemoryRouter(
    [{ element: <Shell />, children: [
      { path: '/faq', element: <Page name="/faq" /> },
      { path: '/organisers', element: <Page name="/organisers" /> },
      { path: '/organisers/:id', element: <Page name="/organisers/:id" /> },
      { path: '/event/:id', element: <Page name="/event/:id" /> },
      { path: '/city/:slug', element: <Page name="/city/:slug" /> },
    ] }],
    { initialEntries: [initial] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  scrollTo = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  resetsSeenAtCommit = {};
});
afterEach(cleanup);

describe('ScrollToTop', () => {
  // Every ordered pair of distinct paths, including two of the same route
  // pattern (organiser -> organiser): the component stays mounted, only the
  // pathname changes, and that still resets.
  const pairs = PATHS.flatMap((from) => PATHS.filter((to) => to !== from).map((to) => [from, to] as const));

  it.each(pairs)('%s -> %s: exactly one reset, in the commit that shows the new page', async (from, to) => {
    const router = mount(from);
    expect(scrollTo).toHaveBeenCalledTimes(1); // the first mount
    scrollTo.mockClear();
    resetsSeenAtCommit = {};

    await act(() => router.navigate(to));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    // The new page's layout effect already sees the reset: it happened inside
    // the commit, not in a later task after a paint.
    expect(resetsSeenAtCommit[to]).toBe(1);
  });

  it('Back and Forward reset to the top as well (manual restoration, nothing restored)', async () => {
    const router = mount('/faq');
    await act(() => router.navigate('/organisers/ritmo'));
    scrollTo.mockClear();
    await act(() => router.navigate(-1));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    await act(() => router.navigate(1));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('an in-app navigation to a #hash URL does not reset (unchanged behaviour)', async () => {
    const router = mount('/faq');
    scrollTo.mockClear();
    await act(() => router.navigate('/organisers/ritmo#upcoming'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('a direct load with a #hash does not reset either', () => {
    mount('/organisers/salsa#upcoming');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('a query-only change (filters) does not reset', async () => {
    const router = mount('/organisers');
    scrollTo.mockClear();
    await act(() => router.navigate('/organisers?city=london'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('dropping the hash on the same pathname resets (unchanged: the deps are pathname AND hash)', async () => {
    const router = mount('/organisers/salsa#upcoming');
    await act(() => router.navigate('/organisers/salsa'));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('navigating to the same path again does not reset', async () => {
    const router = mount('/faq');
    scrollTo.mockClear();
    await act(() => router.navigate('/faq'));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
