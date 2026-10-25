// @vitest-environment jsdom
/**
 * M10 / M24 / M71 (owner decisions): every way out of onboarding REPLACES the
 * /app/welcome history entry, so browser Back never re-opens the "You're in"
 * card; and a finished dancer who opens /app/welcome directly (an old bookmark)
 * is never re-asked a card: a 70% profile gets the end card ("Go to Home"), a
 * 100% one goes straight on to the end.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const nav = vi.hoisted(() => ({ calls: [] as Array<[unknown, unknown]> }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return ((to: unknown, opts?: unknown) => {
        nav.calls.push([to, opts]);
        return (navigate as (t: unknown, o?: unknown) => void)(to, opts);
      }) as ReturnType<typeof actual.useNavigate>;
    },
  };
});
vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...(await importOriginal<object>()), trackAnalyticsEvent: vi.fn() }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import type { DancerShapeName } from '@/modules/dancer-app/api/fixtures';

afterEach(() => {
  cleanup();
  resetShell();
  nav.calls = [];
});

const open = (shape: DancerShapeName, path = '/app/welcome') => renderInShell({ path, backend: { shape } });
const click = async (name: string) => {
  const node = (await screen.findAllByText(name)).map((n) => n.closest('button')).find(Boolean);
  fireEvent.click(node as HTMLElement);
};
/** Every navigation that left onboarding for `end`. */
const endCalls = (end: string) => nav.calls.filter(([to]) => to === end);

describe('every end of onboarding replaces /app/welcome (Back never re-opens "You\'re in")', () => {
  it('"You\'re in" -> Go to Home', async () => {
    const { location } = open('fourFieldComplete');
    await screen.findByTestId('onboarding-in-card');
    await click('Go to Home');
    await waitFor(() => expect(location()).toBe('/app/home'));
    expect(endCalls('/app/home')).toEqual([['/app/home', { replace: true }]]);
  });

  it('"Nice work" -> Go to Home', async () => {
    const { location } = open('fourFieldComplete');
    await click('Two quick questions');
    await click('Skip');
    await click('Skip');
    await screen.findByTestId('onboarding-nice-card');
    await click('Go to Home');
    await waitFor(() => expect(location()).toBe('/app/home'));
    expect(endCalls('/app/home')).toEqual([['/app/home', { replace: true }]]);
  });

  it('"You\'re in" with an onward returnTo (the organiser link) -> Next: set up your organiser page', async () => {
    open('fourFieldComplete', `/app/welcome?returnTo=${encodeURIComponent('/account/o')}`);
    await screen.findByTestId('onboarding-in-card');
    await click('Next: set up your organiser page');
    await waitFor(() => expect(endCalls('/account/o')).toHaveLength(1));
    expect(endCalls('/account/o')).toEqual([['/account/o', { replace: true }]]);
  });
});

describe('M71: a finished dancer opening /app/welcome directly is never re-asked a card', () => {
  it('70% (required done): the end card, with Go to Home; no required card', async () => {
    open('fourFieldComplete');
    expect(await screen.findByTestId('onboarding-in-card')).toBeTruthy();
    expect(screen.getByTestId('onboarding-home').textContent).toBe('Go to Home');
    for (const id of ['name', 'city', 'role', 'photo']) expect(screen.queryByTestId(`onboarding-${id}`)).toBeNull();
  });

  it('100%: straight on to the end, replacing /app/welcome', async () => {
    const { location } = open('completeAllExtras');
    await waitFor(() => expect(location()).toBe('/app/home'));
    expect(endCalls('/app/home')).toEqual([['/app/home', { replace: true }]]);
    expect(screen.queryByTestId('onboarding-in-card')).toBeNull();
  });
});
