// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
 * p3-shell-exits: New event (R1 flows/new), Account (R1 More), Help and an event's Organisers
 * render inside /account/p3 in P3's frame, and every Back and way out stays in P3.
 */

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
import P3Routes from '../P3Routes';
import { P3_BASE, P3_PATHS } from '../paths';
import { P3_SURFACE } from '../../you/surface';
import { ORG_PATHS } from '../../../shell/paths';
import { R1_SURFACE } from '../../../shell/surface';
import { helpRows } from '../../../more/help/helpRows';

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function at(path: string) {
  // nothing fetches: every screen shows its loading state in its frame (its back link is there)
  const qc = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => { cleanup(); });

const S = 'ser 1';
describe('route matrix: each screen renders inside P3, one top bar, Back stays in P3', () => {
  it.each([
    ['New event: what', P3_PATHS.newWhat, 'org-new-what', P3_PATHS.events],
    ['New event: what for a page', P3_PATHS.newWhatFor('org 1'), 'org-new-what', P3_PATHS.events],
    ['New event: name', P3_PATHS.newName('recurring'), 'org-new-name-step', P3_PATHS.newWhat],
    ['New event: venue', P3_PATHS.newVenue(S), 'org-new-venue', P3_PATHS.events],
    ['New event: date', P3_PATHS.newDate(S), 'org-new-step', P3_PATHS.newVenue(S)],
    ['New event: time', P3_PATHS.newTime(S), 'org-new-step', P3_PATHS.newDate(S)],
    ['New event: cover', P3_PATHS.newCover(S), 'org-new-step', P3_PATHS.newTime(S)],
    ['Account', P3_PATHS.youAccount, 'org-page-more', P3_PATHS.you],
    ['Help', P3_PATHS.youHelp, 'org-page-help', P3_PATHS.youAccount],
    ['an event’s Organisers', P3_PATHS.eventOrganisers(S), 'org-page-organisers', P3_PATHS.event(S)],
  ])('%s', async (_n, path, testId, back) => {
    const { container } = at(path);
    const page = await screen.findByTestId(testId);
    expect(screen.getByTestId('p3-shell').contains(page)).toBe(true);
    expect(container.querySelectorAll('header').length).toBe(1);
    expect(container.querySelectorAll('main').length).toBe(1);
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(back);
    for (const a of container.querySelectorAll('a[href^="/account/"]')) expect(a.getAttribute('href')).toMatch(/^\/account\/(p3|settings)(\/|\?|$)/);
  });

  it('a New event step URL with no step falls back to the first step inside P3', async () => {
    at(`${P3_BASE}/new/name`);
    await screen.findByTestId('org-new-what');
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.newWhat);
  });

  it('Save as draft and leave (cancel mid-create) goes to P3 Events', async () => {
    at(P3_PATHS.newVenue(S));
    fireEvent.click(await screen.findByTestId('org-new-leave'));
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.events);
  });

  // You's Account row itself is pinned in you.matrix (href P3_PATHS.youAccount)
  it('Help > back lands on Account (titled Account); Account > back lands on You', async () => {
    at(P3_PATHS.youHelp);
    fireEvent.click(await screen.findByTestId('org-back'));
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.youAccount);
    await screen.findByTestId('org-page-more');
    expect(screen.getByText('Account', { selector: 'h1' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-back'));
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.you);
  });
});

describe('the surfaces: P3 points every exit the shared screens use at P3, R1 is unchanged', () => {
  it('New event, Account, Help, events: P3 paths', () => {
    const p = P3_SURFACE.paths;
    expect([p.newWhat, p.newWhatFor('o'), p.newName('one_off'), p.newVenue('s'), p.newDate('s'), p.newTime('s'), p.newCover('s'), p.more, p.help, p.event('s'), p.events, p.eventOrganisers('s'), p.eventProgramme('s')])
      .toEqual([P3_PATHS.newWhat, `${P3_BASE}/new/what?o=o`, `${P3_BASE}/new/name?format=one_off`, `${P3_BASE}/new/s/venue`, `${P3_BASE}/new/s/date`, `${P3_BASE}/new/s/time`, `${P3_BASE}/new/s/cover`, P3_PATHS.youAccount, P3_PATHS.youHelp, P3_PATHS.event('s'), P3_PATHS.events, P3_PATHS.eventOrganisers('s'), P3_PATHS.event('s')]);
    expect(P3_SURFACE.createHub).toEqual({ to: P3_PATHS.events, label: 'Events' });
    expect(R1_SURFACE.createHub).toEqual({ to: ORG_PATHS.home, label: 'Home' });
    expect(R1_SURFACE.moreTitle).toBe('More');
  });

  it('every Help row in P3 is a P3 link', () => {
    for (const row of helpRows(P3_SURFACE.paths)) expect(row.to.startsWith(`${P3_BASE}/`)).toBe(true);
  });
});

// The R1 links P3 still keeps on purpose: the surface's base (every key not overridden) and
// R1's Welcome for an invite while P3 is off (acceptedInviteLanding).
const ALLOWED = new Map([['you/surface.tsx', 1], ['shell/paths.ts', 1]]);
const P3_DIR = join(process.cwd(), 'src/modules/organiser/p3');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) return f === '__tests__' ? [] : sources(full);
    return /\.tsx?$/.test(f) ? [full] : [];
  });
}

describe('no P3 link targets the R1 area (/account/o) any more', () => {
  it.each(sources(P3_DIR).map((f) => [f.slice(P3_DIR.length + 1)]))('%s', (rel) => {
    const src = readFileSync(join(P3_DIR, rel), 'utf8');
    expect(src).not.toMatch(/['"`]\/account\/o[/'"`?]/);
    const uses = (src.match(/\bORG_PATHS\./g) ?? []).length + (src.match(/\.\.\.ORG_PATHS\b/g) ?? []).length;
    expect(uses).toBe(ALLOWED.get(rel) ?? 0);
  });
});
