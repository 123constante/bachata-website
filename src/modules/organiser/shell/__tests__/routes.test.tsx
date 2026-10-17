// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
// The real pages read data: keep every read pending and give them a signed-in user.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: () => new Promise(() => {}), from: () => ({}) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
// Not about the gate (gate.matrix.test.tsx is): the account is complete.
vi.mock('@/lib/accountGate', () => ({ useAccountGate: () => ({ status: 'complete', dancerProfileId: 'p1', deletion: null }) }));

import OrganiserRoutes from '../OrganiserRoutes';
import { OrganiserShell } from '..';

vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});
afterEach(cleanup);

// The first visit to each folder pays its cold lazy import (real chunks, not mocks).
const COLD = { timeout: 10_000 };

function at(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/*" element={<OrganiserRoutes />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('main screens stay mounted on the new paths', () => {
  it.each([
    ['/account/o', 'org-page-home'],
    ['/account/o/switch', 'org-page-switch'],
    // /account/o/done (no router state goes Home) is pinned once, in the Change block below.
    ['/account/o/events', 'org-page-events'],
    ['/account/o/new/what', 'org-new-what'],
    // The name step needs its ?format= (without one it goes back to new/what).
    ['/account/o/new/name?format=recurring', 'org-new-name-step'],
    ['/account/o/new/s1/venue', 'org-new-venue'],
    // The date, time and cover steps share the step shell (org-new-step); each is pinned by its own control.
    ['/account/o/new/s1/date', 'org-new-step'],
    ['/account/o/new/s1/time', 'org-new-time'],
    ['/account/o/new/s1/cover', 'org-new-cover-input'],
    ['/account/o/events/s1', 'org-page-event'],
    ['/account/o/events/s1/details', 'org-page-details'],
    ['/account/o/change/s1/o1/lineup', 'org-page-date'],
    ['/account/o/team', 'org-page-team'],
    ['/account/o/team/add', 'org-page-team-add'],
    ['/account/o/team/u2', 'org-page-team-person'],
    ['/account/o/handover', 'org-page-handover'],
    ['/account/o/handover/u2', 'org-page-handover-confirm'],
    ['/account/o/page', 'org-page-page'],
    ['/account/o/more', 'org-page-more'],
    ['/account/o/more/help', 'org-page-help'],
    ['/account/o/cover/s1', 'org-page-cover'],
  ])('%s renders %s, with no tab bar', async (path, page) => {
    at(path);
    expect(await screen.findByTestId(page, {}, COLD)).toBeTruthy();
    expect(screen.queryByTestId('org-tabbar')).toBeNull();
  });

  it('sends unknown paths to Home', async () => {
    at('/account/o/nope');
    expect(await screen.findByTestId('org-page-home', {}, COLD)).toBeTruthy();
  });
});

describe('Add a date and Cancel a date (S3) own their six paths', () => {
  it.each([
    ['/account/o/add', 'add-loading'],
    ['/account/o/add/s1', 'add-loading'],
    ['/account/o/add/s1/2026-10-27', 'add-loading'],
    ['/account/o/cancel', 'cancel-loading'],
    ['/account/o/cancel/s1', 'cancel-loading'],
    ['/account/o/cancel/s1/o1', 'cancel-loading'],
  ])('%s renders the flow (reads pending: %s), not a placeholder', async (path, loading) => {
    at(path);
    expect(await screen.findByTestId(loading, {}, COLD)).toBeTruthy();
    expect(screen.queryByTestId('org-placeholder')).toBeNull();
  });
});

describe('Change a date (S2) owns its six paths', () => {
  it.each([
    '/account/o/change',
    '/account/o/change/s1',
    '/account/o/change/s1/o1',
    '/account/o/change/s1/o1/time',
    '/account/o/change/s1/o1/venue',
    '/account/o/change/s1/o1/day',
  ])('%s renders the flow (reads pending: loading), not a placeholder', async (path) => {
    at(path);
    expect(await screen.findByTestId('change-loading', {}, COLD)).toBeTruthy();
    expect(screen.queryByTestId('org-placeholder')).toBeNull();
    expect(screen.queryByTestId('org-page-date')).toBeNull();
  });

  it('/account/o/done is the shared Done screen (a visit with no state goes Home)', async () => {
    at('/account/o/done');
    expect(await screen.findByTestId('org-page-home', {}, COLD)).toBeTruthy();
    expect(screen.queryByTestId('org-placeholder')).toBeNull();
  });
});

describe('every R1 route has landed (no placeholder left)', () => {
  it('OrganiserRoutes points no route at ./placeholders', () => {
    const src = readFileSync(resolve(__dirname, '../OrganiserRoutes.tsx'), 'utf8');
    expect(src).not.toMatch(/import\(['"]\.\/placeholders['"]\)/);
  });
});

describe('OrganiserShell (no tabs, D32)', () => {
  it('stacks top bar, content and action bar, and renders nothing below them', () => {
    render(
      <MemoryRouter>
        <OrganiserShell title="Edit" actionBar={<button>Save</button>}>body</OrganiserShell>
      </MemoryRouter>,
    );
    const shell = screen.getByTestId('org-shell');
    expect(shell.className).toContain('org-theme');
    const order = Array.from(shell.children).map((c) => c.getAttribute('data-testid') ?? c.tagName);
    expect(order).toEqual(['HEADER', 'org-content', 'org-actionbar']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit');
  });

  it('without an action bar the content is the last thing', () => {
    render(
      <MemoryRouter>
        <OrganiserShell title="Home">body</OrganiserShell>
      </MemoryRouter>,
    );
    const order = Array.from(screen.getByTestId('org-shell').children).map((c) => c.getAttribute('data-testid') ?? c.tagName);
    expect(order).toEqual(['HEADER', 'org-content']);
  });

  it('pads the scroller for the bottom safe area only when no action bar does', () => {
    // jsdom's CSS parser drops env() and Chromium resolves it to 0, so assert the
    // inline style string React writes, from static markup.
    const scrollerStyle = (html: string) => /data-testid="org-content"[^>]*?style="([^"]*)"/.exec(html)?.[1] ?? '';
    const without = renderToStaticMarkup(
      <MemoryRouter>
        <OrganiserShell title="Home">body</OrganiserShell>
      </MemoryRouter>,
    );
    expect(scrollerStyle(without)).toBe('padding-bottom:env(safe-area-inset-bottom)');
    const withBar = renderToStaticMarkup(
      <MemoryRouter>
        <OrganiserShell title="Edit" actionBar={<button>Save</button>}>body</OrganiserShell>
      </MemoryRouter>,
    );
    expect(scrollerStyle(withBar)).toBe('');
    expect(withBar).toMatch(/data-testid="org-actionbar"[^>]*style="padding-bottom:env\(safe-area-inset-bottom\)"/);
  });

  it('keeps the two-column split', () => {
    render(
      <MemoryRouter>
        <OrganiserShell list={<p>list</p>} detail={<p>detail</p>} />
      </MemoryRouter>,
    );
    expect(document.querySelector('.org-split')?.getAttribute('data-has-detail')).toBe('true');
  });
});
