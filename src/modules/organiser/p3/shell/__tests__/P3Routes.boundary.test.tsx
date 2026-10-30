// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/*
 * p3-prefix-d D2: a P3 lazy route whose chunk fails to load (here: the door screen and the event
 * page) shows a clear message, Try again and a way back, never a blank screen.
 */

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, organiserTicketing: true } };
});
vi.mock('@/lib/reportClientErrorLazy', () => ({ reportClientErrorLazy: () => undefined }));
// a chunk that will not load: the module itself fails to evaluate, so its dynamic import rejects
vi.mock('../../door/DoorScreen', () => { throw new Error('Failed to load chunk door'); });
vi.mock('../../screens/EventPage', () => { throw new Error('Failed to load chunk event'); });
import P3Routes from '../P3Routes';
import { P3_BASE, P3_PATHS } from '../paths';

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes>
    </MemoryRouter>,
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('a P3 lazy route that fails to load', () => {
  it.each([
    ['the door (own frame)', `${P3_BASE}/events/ser-1/door`, P3_PATHS.event('ser-1')],
    ['the event page (inside the tab frame)', `${P3_BASE}/events/ser-1`, P3_PATHS.events],
  ])('%s shows the message, Try again and a back link', async (_n, path, back) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    at(path);
    const card = await screen.findByTestId('p3-route-error');
    expect(card.textContent).toContain('This screen did not load');
    expect(screen.getByTestId('p3-route-error-retry').textContent).toBe('Try again');
    expect(screen.getByTestId('p3-route-error-back').getAttribute('href')).toBe(back);
  });
});
