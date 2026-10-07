// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));

import OrganiserRoutes from '../shell/OrganiserRoutes';
import { OrganiserShell, ORG_PATHS, TABS } from '../shell';

afterEach(cleanup);

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/account/o/*" element={<OrganiserRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('organiser routes', () => {
  it.each([
    ['/account/o', 'org-page-home', 'org-tab-home'],
    ['/account/o/events', 'org-page-events', 'org-tab-events'],
    ['/account/o/events/new', 'org-page-new-event', 'org-tab-events'],
    ['/account/o/events/s1', 'org-page-event-editor', 'org-tab-events'],
    ['/account/o/events/s1/dates/o1', 'org-page-date', 'org-tab-events'],
    ['/account/o/team', 'org-page-team', 'org-tab-team'],
    ['/account/o/profile', 'org-page-profile', 'org-tab-profile'],
  ])('%s renders its placeholder with the right tab active', async (path, page, tab) => {
    at(path);
    expect(await screen.findByTestId(page)).toBeTruthy();
    expect(screen.getByTestId(tab).getAttribute('aria-current')).toBe('page');
    const active = TABS.filter((t) => screen.getByTestId(`org-tab-${t.key}`).getAttribute('aria-current') === 'page');
    expect(active).toHaveLength(1);
  });

  it('sends unknown paths to Home', async () => {
    at('/account/o/nope');
    expect(await screen.findByTestId('org-page-home')).toBeTruthy();
  });

  it('builds paths', () => {
    expect(ORG_PATHS.date('a b', 'c')).toBe('/account/o/events/a%20b/dates/c');
  });
});

describe('OrganiserShell', () => {
  it('is themed and stacks content, action bar and tab bar in that order', () => {
    render(
      <MemoryRouter>
        <OrganiserShell title="Edit" actionBar={<button>Save</button>}>body</OrganiserShell>
      </MemoryRouter>,
    );
    const shell = screen.getByTestId('org-shell');
    expect(shell.className).toContain('org-theme');
    const order = Array.from(shell.children).map((c) => c.getAttribute('data-testid') ?? c.tagName);
    expect(order).toEqual(['HEADER', 'org-content', 'org-actionbar', 'org-tabbar']);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit');
  });

  it('marks the split when a detail is present', () => {
    render(
      <MemoryRouter>
        <OrganiserShell list={<p>list</p>} detail={<p>detail</p>} />
      </MemoryRouter>,
    );
    expect(document.querySelector('.org-split')?.getAttribute('data-has-detail')).toBe('true');
  });
});
