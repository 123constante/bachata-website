// @vitest-environment jsdom
/** AREA_PATHS routes: every area page sits behind the same AuthGuard as /account/o, and each path opens its page. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-guard">{children}</div> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('../YourAreasPage', () => ({ default: () => <p>your-areas-page</p> }));
vi.mock('../../index', () => ({
  TeacherAreaPage: (p: { profilePath: string; backPath: string; backLabel: string }) => <p>{`teacher-area ${p.profilePath} ${p.backPath} ${p.backLabel}`}</p>,
  TeacherProfilePage: (p: { areaPath: string }) => <p>{`teacher-details ${p.areaPath}`}</p>,
  DjAreaPage: (p: { profilePath: string; backPath: string; backLabel: string }) => <p>{`dj-area ${p.profilePath} ${p.backPath} ${p.backLabel}`}</p>,
  DjProfilePage: (p: { areaPath: string }) => <p>{`dj-details ${p.areaPath}`}</p>,
}));

import AreaRoutes from '../AreaRoutes';

afterEach(cleanup);

function at(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/account/areas" element={<AreaRoutes area="areas" />} />
        <Route path="/account/t/*" element={<AreaRoutes area="teacher" />} />
        <Route path="/account/dj/*" element={<AreaRoutes area="dj" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AreaRoutes', () => {
  it.each([
    ['/account/areas', 'your-areas-page'],
    ['/account/t', 'teacher-area /account/t/details /account/areas Your areas'],
    ['/account/t/details', 'teacher-details /account/t'],
    ['/account/dj', 'dj-area /account/dj/details /account/areas Your areas'],
    ['/account/dj/details', 'dj-details /account/dj'],
  ])('%s', async (url, text) => {
    at(url);
    const guard = screen.getByTestId('auth-guard');
    expect((await screen.findByText(text)).closest('[data-testid="auth-guard"]')).toBe(guard);
  });
});
