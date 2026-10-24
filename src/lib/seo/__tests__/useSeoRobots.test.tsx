// @vitest-environment jsdom
/**
 * People arc S1, the removeChild crash: /dancers (a client page calling useSeo) -> /people/:id
 * (a framework route whose meta() puts a React-owned <meta name="robots"> in <head>) -> any
 * role page threw `NotFoundError: removeChild` (walked on main 2026-10-23, 3 of 3). The wall's
 * useSeo cleanup ran after the hub's head rendered and removed EVERY robots meta, including the
 * one React owns; React then crashed removing it again. useSeo may only remove the robots meta
 * it created itself.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useSeo, type SeoInput } from '../useSeo';

const Page = ({ seo }: { seo: SeoInput }) => {
  useSeo(seo);
  return null;
};

/** A <meta> rendered by React itself (what React Router's <Meta /> does for a framework route). */
const RouteMeta = () => <meta name="robots" content="noindex,nofollow" data-route="1" />;

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
});

describe('useSeo never removes a robots meta it did not create', () => {
  it.each([
    ['an indexable page (wall)', false],
    ['a noindex page', true],
  ])('%s unmounting after a route-owned robots meta rendered: no removeChild crash', (_label, noindex) => {
    const page = render(<Page seo={{ title: 'Dancers', description: 'd', noindex }} />);
    // The hub's head (React-owned, rendered into <head> through a portal-like owner).
    const routeHead = render(<RouteMeta />, { container: document.head });
    const routeOwned = document.head.querySelector('meta[data-route="1"]');
    expect(routeOwned).not.toBeNull();
    page.unmount(); // the wall's cleanup runs late (page transition)
    expect(routeOwned?.parentNode).toBe(document.head);
    // Leaving the hub: React removes its own meta. Threw NotFoundError before the fix.
    expect(() => act(() => routeHead.unmount())).not.toThrow();
  });

  it('an indexable page mounting while a route-owned robots meta is still in head leaves it alone', () => {
    const routeHead = render(<RouteMeta />, { container: document.head });
    render(<Page seo={{ title: 'Dancers', description: 'd' }} />);
    expect(document.head.querySelector('meta[data-route="1"]')).not.toBeNull();
    expect(() => act(() => routeHead.unmount())).not.toThrow();
  });

  it('still sets noindex while mounted and removes its own meta on unmount', () => {
    const page = render(<Page seo={{ title: 'Hidden', description: 'd', noindex: true }} />);
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    page.unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('a late cleanup from the previous noindex page never takes away the next page noindex', () => {
    const a = render(<Page seo={{ title: 'Edit', description: 'd', noindex: true }} />);
    const b = render(<Page seo={{ title: 'Hidden too', description: 'd', noindex: true }} />);
    a.unmount(); // A's cleanup runs after B's effect (page transition)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,nofollow');
    b.unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('an indexable page clears a noindex meta an earlier useSeo page left', () => {
    const a = render(<Page seo={{ title: 'Hidden', description: 'd', noindex: true }} />);
    const b = render(<Page seo={{ title: 'Shown', description: 'd' }} />);
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    a.unmount();
    b.unmount();
  });
});
