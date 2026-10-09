// @vitest-environment jsdom
/**
 * React #421 on signed-in page loads (organiser /account/o/*, /event/:id).
 *
 * AuthProvider sits ABOVE the route's <Suspense> (app/root.tsx -> AppProviders
 * -> AppChrome). React 18 hydrates a Suspense boundary's content in a later,
 * low-priority pass, and keeps it dehydrated while anything inside suspends.
 * A context change from above marks every still-dehydrated boundary below it as
 * updated; if that update is NOT a transition, React gives up on hydrating the
 * boundary, throws away the server HTML and client-renders it (#421).
 *
 * For a signed-in visitor, auth resolution (getSession / INITIAL_SESSION)
 * lands after hydrateRoot and changes the AuthContext value -- exactly that
 * update. This test reproduces it: server-render, hydrate with the boundary's
 * content still pending, resolve a session, then let the content arrive.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense, lazy, type ComponentType } from 'react';
import { act } from 'react-dom/test-utils';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';

type Session = { user: { id: string; email: string } };

const auth = vi.hoisted(() => {
  let resolveSession: (s: unknown) => void = () => {};
  const sessionPromise = new Promise((r) => { resolveSession = r; });
  return {
    resolveSession: (s: unknown) => resolveSession(s),
    client: {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        getSession: () => sessionPromise.then((session) => ({ data: { session } })),
      },
    },
  };
});

vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: () => Promise.resolve(auth.client) }));

import { AuthProvider, useAuth } from '@/hooks/useAuth';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Who() {
  const { user, authStatus } = useAuth();
  return <span data-testid="who">{authStatus}:{user?.email ?? 'anon'}</span>;
}

function Content() {
  return <p data-testid="content">Event content</p>;
}

const tree = (Body: ComponentType) => (
  <AuthProvider>
    <Who />
    <Suspense fallback={<p data-testid="fallback">loading</p>}>
      <Body />
    </Suspense>
  </AuthProvider>
);

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

describe('AuthProvider during hydration', () => {
  it('a session resolving while a route Suspense boundary is still dehydrated does not force client rendering (#421)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree(Content));
    const serverContent = container.querySelector('[data-testid="content"]');
    expect(serverContent).not.toBeNull();

    // On the client the boundary's content is a lazy chunk still downloading,
    // so the boundary stays dehydrated until it arrives.
    let arrive: () => void = () => {};
    const LazyContent = lazy(() => new Promise<{ default: ComponentType }>((r) => { arrive = () => r({ default: Content }); }));

    const onRecoverableError = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, tree(LazyContent), { onRecoverableError });
    });

    // Auth resolves (signed-in visitor) while the boundary is still dehydrated.
    await act(async () => {
      auth.resolveSession({ user: { id: 'u1', email: 'me@x.example' } } satisfies Session);
    });

    // The chunk arrives; the boundary hydrates.
    await act(async () => {
      arrive();
    });

    expect(onRecoverableError.mock.calls.map((c) => String((c[0] as Error)?.message))).toEqual([]);
    // The server DOM node was hydrated in place, not thrown away and rebuilt.
    expect(container.querySelector('[data-testid="content"]')).toBe(serverContent);
    // And the session still reached the UI.
    expect(container.querySelector('[data-testid="who"]')?.textContent).toBe('ready:me@x.example');
  });
});
