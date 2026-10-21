// @vitest-environment jsdom
/**
 * Arc 1 flow 7b: New event asks "Which page is this for?" only when the login
 * runs 2 or more pages; one page skips it. Table-driven: page count x the link
 * New event was opened with -> the screen shown, the page ticked, and where
 * Continue goes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home } from '../../../events/__tests__/fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));

import NewFlow from '../NewFlow';
import { WHICH_PAGE_TITLE, needsPagePick } from '../whichPage';
import { ORG_PATHS } from '../../../shell/paths';

const page = (id: string, name: string) => ({ ...home().organisers[0], id, name });
let pages = [page('org1', 'Salsa Norte')];

beforeEach(() => {
  pages = [page('org1', 'Salsa Norte')];
  window.localStorage.clear();
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: { ...home(), organisers: pages }, error: null };
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/new/what" element={<NewFlow />} />
          <Route path="/account/o/new/name" element={<NewFlow />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const TWO = [page('org1', 'Salsa Norte'), page('org2', 'Bachata Club')];

const CASES: Array<{ name: string; pages: ReturnType<typeof page>[]; path: string; asks: boolean; ticked?: string }> = [
  { name: 'one page, bare link: skipped', pages: [page('org1', 'Salsa Norte')], path: ORG_PATHS.newWhat, asks: false },
  { name: 'one page, ?o= link: skipped', pages: [page('org1', 'Salsa Norte')], path: ORG_PATHS.newWhatFor('org1'), asks: false },
  { name: 'two pages, bare link: asked, first page ticked', pages: TWO, path: ORG_PATHS.newWhat, asks: true, ticked: 'org1' },
  { name: 'two pages, ?o=org2 (Home or the page): asked, that page ticked', pages: TWO, path: ORG_PATHS.newWhatFor('org2'), asks: true, ticked: 'org2' },
  { name: 'two pages, already answered: not asked again', pages: TWO, path: `${ORG_PATHS.newWhatFor('org2')}&page=set`, asks: false },
];

describe('needsPagePick', () => {
  it.each([
    [0, '', false],
    [1, '', false],
    [1, 'page=set', false],
    [2, '', true],
    [2, 'o=x', true],
    [2, 'o=x&page=set', false],
    [3, '', true],
  ] as const)('%i pages, ?%s -> %s', (count, query, expected) => {
    expect(needsPagePick(count, new URLSearchParams(query))).toBe(expected);
  });
});

describe('New event: which page', () => {
  it.each(CASES)('$name', async ({ pages: p, path, asks, ticked }) => {
    pages = p;
    mount(path);
    // The format question shows once the page question is not needed.
    if (!asks) {
      expect(await screen.findByTestId('org-new-format-recurring')).toBeTruthy();
      expect(screen.queryByText(WHICH_PAGE_TITLE)).toBeNull();
      return;
    }
    expect(await screen.findByText(WHICH_PAGE_TITLE)).toBeTruthy();
    expect(screen.queryByTestId('org-new-format-recurring')).toBeNull();
    const rows = screen.getAllByTestId('org-new-page-row');
    expect(rows.map((r) => r.textContent)).toEqual(p.map((o) => o.name));
    expect(rows.filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.getAttribute('data-org'))).toEqual([ticked]);
  });

  it('Continue carries the chosen page into the format step, and the format step keeps it', async () => {
    pages = TWO;
    mount(ORG_PATHS.newWhat);
    fireEvent.click((await screen.findAllByTestId('org-new-page-row'))[1]);
    fireEvent.click(screen.getByTestId('org-new-page-continue'));
    expect(await screen.findByTestId('org-new-format-recurring')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.newWhat}?o=org2&page=set`);
    fireEvent.click(screen.getByTestId('org-new-format-recurring'));
    expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.newName('recurring')}&o=org2&page=set`);
  });
});
