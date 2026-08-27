// @vitest-environment node
/**
 * SSR-safety gate for the /event/:id render path (SSR/ISR migration, Phase 1).
 *
 * Renders the REAL provider stack (AppProviders + AppShell from src/App.tsx)
 * through react-dom/server `renderToString` in PLAIN NODE — deliberately not
 * jsdom, which defines window/localStorage and would mask the exact
 * render-time / module-top-level browser-global bugs this gate exists to catch.
 *
 * HARD CONSTRAINT: @/integrations/supabase/client is never mocked here — the
 * whole point is to prove the real module evaluates in node without throwing.
 *
 * SWALLOW-PROOF: the app wraps routes in class ErrorBoundaries whose
 * getDerivedStateFromError runs during SSR, so a render-time ReferenceError is
 * CAUGHT and replaced with a "Something went wrong" fallback instead of
 * rejecting the render. Asserting "did not throw" is therefore not enough — we
 * also assert the output contains no error-boundary fallback and that no
 * ReferenceError was logged.
 *
 * App modules are imported DYNAMICALLY (never statically) so the env fallback
 * in beforeAll runs before the supabase client module evaluates, and so a
 * module-load ReferenceError fails a test instead of crashing collection.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
// v7: StaticRouter moved from the removed 'react-router-dom/server' subpath into
// the 'react-router' core package (spike branch — RR7 framework-mode migration).
import { StaticRouter } from 'react-router';

const EVENT_UUID = '00000000-0000-4000-8000-000000000000';
// Shared by the AppChrome + AnimatedRoutes Suspense fallbacks (Skeleton). Its
// absence proves a render flushed past the lazy boundaries into the real route.
const FALLBACK_MARKER = 'h-48 w-full rounded-xl';
// Both ErrorBoundary and PageErrorBoundary render this copy when they catch a
// render error. Its presence means an error was thrown and swallowed on the
// server — a false green if we only checked for a thrown promise.
const ERROR_BOUNDARY_MARKER = 'Something went wrong';

let realFetch: typeof globalThis.fetch;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  // Local + CI runs get these from .env (Vite loads it for mode 'test'); .env is
  // gitignored, so envless checkouts still need createClient to evaluate. Must
  // run before the dynamic import()s below — hence nothing from src/ is
  // statically imported in this file.
  if (!import.meta.env.VITE_SUPABASE_URL) {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://stub-project.supabase.co');
  }
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'stub-publishable-key');
  }
  // Enforce offline determinism: renderToString runs no effects, so nothing
  // should fetch. If anything does, fail loudly instead of hitting prod.
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('SSR gate: network fetch must not happen during renderToString');
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
});

beforeEach(() => {
  // Capture (and silence) console.error so a swallowed render error surfaces as
  // an assertion instead of stderr noise. React logs boundary-caught errors here
  // during SSR.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

/** Fail if any browser-global ReferenceError was thrown-and-swallowed. */
function expectNoReferenceError() {
  const logged = consoleErrorSpy.mock.calls
    .flat()
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
    .join('\n');
  expect(logged).not.toMatch(/ReferenceError|is not defined/);
}

/**
 * Assert a full-page render is clean. A render-time throw inside a Suspense
 * boundary does NOT reject renderToString — React 18 renders the fallback and
 * embeds the error inline as `<template data-msg="... is not defined" ...>`, and
 * class ErrorBoundaries swallow into a "Something went wrong" fallback. Check
 * for all three signatures so a swallowed error can't read as green.
 */
function expectCleanRender(html: string) {
  expect(html).toContain('id="main-content"');
  // Flushed past the lazy Suspense fallbacks into the real route (also fires if
  // a throw made React render the route Suspense fallback).
  expect(html).not.toContain(FALLBACK_MARKER);
  // No class ErrorBoundary caught a render error.
  expect(html).not.toContain(ERROR_BOUNDARY_MARKER);
  // No React SSR error template (embeds the thrown message, e.g. the
  // "localStorage is not defined" ReferenceError).
  expect(html).not.toContain('is not defined');
  expectNoReferenceError();
}

/**
 * Render a route through the real provider stack. The event path has two lazy
 * layers (AnimatedRoutes inside AppChrome, then the page inside AnimatedRoutes):
 * React 18 renderToString emits the Suspense fallback and kicks off each lazy
 * import, so re-render after each import settles until the output stabilises.
 * Capped so a genuine failure can't spin forever.
 */
async function renderRouteDeep(location: string, opts?: { client?: QueryClient }): Promise<string> {
  const { AppProviders, AppShell, createQueryClient } = await import('@/App');
  // Always render with a fresh per-request client — this is a node env with no
  // window, so the browser-singleton fallback (getBrowserQueryClient()) throws
  // by design. Modelling real SSR (a client per render) also means no query
  // cache is shared between the renders in this suite.
  const client = opts?.client ?? createQueryClient();
  const tree = (
    <AppProviders client={client}>
      <StaticRouter location={location}>
        <AppShell />
      </StaticRouter>
    </AppProviders>
  );
  let html = renderToString(tree);
  for (let pass = 0; pass < 12; pass++) {
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const next = renderToString(tree);
    if (next === html) break;
    html = next;
  }
  return html;
}

// Timeout raised off the 5s default: these cases renderToString the whole event
// shell (providers + router + GlobalLayout), which is the slowest thing in the
// unit suite and was already running at ~85% of the default budget -- so it went
// red purely from parallel load whenever another test file was added. The work
// is genuinely slow, not hung; a hang still fails, just 30s later.
//
// SECOND RAISE, 15s -> 30s (2026-08-27), for the reason the paragraph above
// predicted: tests/client/navigationSplash.test.tsx became only the SECOND
// jsdom-environment file in the suite, and a jsdom environment costs ~45s to
// stand up on this machine. Isolated both ways before touching this line --
// the SSR file passes 6/6 alone, the full suite passes 1099/1099 with the new
// file removed, and reds only with both present. Nothing about the render path
// changed.
//
// This budget is now load-bearing in a way that will keep drifting: it is sized
// against how many OTHER files compete for the pool, not against how long this
// render actually takes. If a third jsdom file lands and this reds again, do
// not simply raise it a third time -- measure this describe in isolation first,
// because a raise that outruns a real regression is exactly how this stops
// gating anything.
describe('SSR safety: /event/:id render path (node, renderToString)', { timeout: 30_000 }, () => {
  it('imports the real supabase client module in node without throwing', async () => {
    await expect(import('@/integrations/supabase/client')).resolves.toHaveProperty('supabase');
  });

  it('renders the /event/:id shell (providers + CityProvider + route) without a swallowed error', async () => {
    const html = await renderRouteDeep(`/event/${EVENT_UUID}`);
    expectCleanRender(html);
    expect(html.length).toBeGreaterThan(500);
  });

  it('renders GlobalLayout (framer useScroll/useSpring) on the server without ReferenceError', async () => {
    // The deepest SSR concern on the event path: the blocker audit flagged
    // useScroll(), but framer-motion v12 attaches all DOM listeners in effects,
    // so the hook call is render-safe. Prove it empirically by rendering the
    // component (which the event page mounts) directly.
    const { default: GlobalLayout } = await import('@/components/layout/GlobalLayout');
    const html = renderToString(
      <StaticRouter location={`/event/${EVENT_UUID}`}>
        <GlobalLayout hero={{ titleWhite: '', titleOrange: '' }} gradientPalette="bento" floatingCount={0}>
          <div data-ssr-child="1" />
        </GlobalLayout>
      </StaticRouter>,
    );
    // The scroll-progress bar renders (showProgressBar defaults true) => useScroll
    // + useSpring ran at render on the server without touching window.
    expect(html).toContain('origin-left');
    expect(html).toContain('data-ssr-child');
    expectNoReferenceError();
  });

  it('getBrowserQueryClient() throws on the server (no window) instead of sharing a cache', async () => {
    // The browser-singleton fallback must never run server-side: reusing one
    // module-scoped client across requests would leak request A's cached,
    // city-specific query data into request B. In this node env window is
    // undefined, so the guard must throw rather than mint a shared singleton.
    const { getBrowserQueryClient } = await import('@/App');
    expect(() => getBrowserQueryClient()).toThrow(/on the server/);
  });

  it('renders /event/:id with a FRESH createQueryClient() (SSR factory) cleanly', async () => {
    // Phase 2 seam: a server render mints a per-request client via the factory
    // instead of the browser's shared singleton. Prove a fresh client renders
    // the same path cleanly in node (no module-eval throw, no swallowed error),
    // exercising the createQueryClient() export and AppProviders' client prop.
    const { createQueryClient } = await import('@/App');
    const client = createQueryClient();
    const html = await renderRouteDeep(`/event/${EVENT_UUID}`, { client });
    expectCleanRender(html);
    expect(html.length).toBeGreaterThan(500);
  });

  it('renders route "/" (CityRedirect render-time localStorage) without a swallowed error', async () => {
    // CityRedirect reads localStorage during render, then returns <Navigate> (a
    // warn-and-no-op under StaticRouter). If the read throws, the surrounding
    // ErrorBoundary swallows it into a "Something went wrong" fallback — which is
    // exactly what this asserts against.
    const html = await renderRouteDeep('/');
    expectCleanRender(html);
  });
});
