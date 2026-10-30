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
// lazyWithRetry's one reload already happened and the chunk still fails: the boundary's case
vi.mock('@/lib/staleChunk', async (orig) => ({
  ...(await orig<typeof import('@/lib/staleChunk')>()),
  attemptChunkReloadOnce: () => false,
  chunkReloadAttempted: () => true,
}));
vi.mock('@/lib/reportClientErrorLazy', () => ({ reportClientErrorLazy: () => undefined }));
// a chunk that will not load: reading the export rejects the lazy import with the browser's own
// message (a throwing vi.mock factory would be re-worded by vitest)
const gone = (name: string) => () => { throw new Error(`Failed to fetch dynamically imported module: ${name}`); };
vi.mock('../../door/DoorScreen', () => ({ get DoorScreen() { return gone('door')(); } }));
vi.mock('../../screens/EventPage', () => ({ get EventPage() { return gone('event')(); } }));
vi.mock('../../you/YouScreen', () => ({ get YouScreen() { return gone('you')(); } }));
vi.mock('../../../switch', () => ({ get default() { return gone('switch')(); } }));
// a plain bug in a screen that did load: not a signal problem
vi.mock('../../screens/AllDatesScreen', () => ({ AllDatesScreen: () => { throw new Error('boom'); } }));
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

describe('the boundary inside the You hub and on a plain render bug', () => {
  it('the You hub itself: the card in the tab frame, no back link to the page already showing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = at(P3_PATHS.you);
    expect((await screen.findByTestId('p3-route-error')).textContent).toContain('This screen did not load');
    expect(screen.queryByTestId('p3-route-error-back')).toBeNull();
    expect(container.querySelectorAll('header').length).toBe(1);
    expect(container.querySelectorAll('main').length).toBe(1);
  });

  it('a screen You pushes (Switch page): its own top bar, back to You', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = at(P3_PATHS.youSwitch);
    await screen.findByTestId('p3-route-error');
    expect(screen.getByTestId('p3-route-error-back').getAttribute('href')).toBe(P3_PATHS.you);
    expect(container.querySelectorAll('header').length).toBe(1);
  });

  it('a render bug says so, not "check the signal"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    at(P3_PATHS.eventDates('ser-1'));
    const card = await screen.findByTestId('p3-route-error');
    expect(card.textContent).toContain('Something went wrong on this screen');
    expect(card.textContent).not.toContain('signal');
    expect(screen.getByTestId('p3-route-error-back').getAttribute('href')).toBe(P3_PATHS.event('ser-1'));
  });
});
