// @vitest-environment jsdom
/** Slice A restyle behaviours (D119 / D120): home link on every area route, Discard sheet, visible Saved, Skip for now. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));

import YourAreasPage from '../home/YourAreasPage';
import TeacherAreaPage from '../teacher/TeacherAreaPage';
import TeacherProfilePage from '../teacher/TeacherProfilePage';
import DjAreaPage from '../dj/DjAreaPage';
import DjProfilePage from '../dj/DjProfilePage';
import { SiteHomeLink } from '..';
import type { RoleWriters } from '../home/rolesApi';

const ROWS = [
  { role: 'dancer', active: true, complete: true }, { role: 'organiser', active: false, complete: false },
  { role: 'teacher', active: true, complete: true }, { role: 'dj', active: false, complete: false },
];
const details = { years_teaching: 6, teaching_styles: [], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null };

beforeEach(() => {
  rpc.mockReset().mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
    if (fn === 'my_roles_v1') return { data: ROWS, error: null };
    if (fn === 'my_profile_progress_v1') return { data: { percent: 50, required_left: 0, publish_ready: true, steps: [], declined: [] }, error: null };
    if (fn === 'my_role_details_v1') return { data: { role: args?.p_role, person_id: 'p', details }, error: null };
    if (fn === 'my_lineup_appearances_v1') return { data: [], error: null };
    if (fn === 'save_my_role_v1') return { data: { role: 'teacher', person_id: 'p', changed: true, changed_keys: ['years_teaching'], details: { ...details, years_teaching: 9 } }, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
function mount(ui: ReactElement, at = '/here') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/here" element={ui} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('D120: every person-area route shows the "Bachata Calendar" home link', () => {
  it.each([
    ['/account/areas', () => <YourAreasPage />],
    ['/account/t', () => <TeacherAreaPage />],
    ['/account/t/details', () => <TeacherProfilePage />],
    ['/account/dj', () => <DjAreaPage />],
    ['/account/dj/details', () => <DjProfilePage />],
  ] as [string, () => ReactElement][])('%s', async (_path, page) => {
    mount(page());
    const link = await screen.findByTestId('site-home-link');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toBe('Bachata Calendar');
    expect(link.className).toMatch(/h-\[44px\]/);
  });
  it('is exported for slice B', () => {
    mount(<SiteHomeLink />);
    expect(screen.getByTestId('site-home-link')).toBeTruthy();
  });
});

describe('Teacher details: Saved toast and Discard changes?', () => {
  const years = () => screen.findByLabelText(/years/i);
  it('a save shows the green Saved toast (and the screen-reader line stays)', async () => {
    mount(<TeacherProfilePage />);
    fireEvent.change(await years(), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('save-details'));
    expect((await screen.findByTestId('saved-toast')).textContent).toBe('Saved');
    await waitFor(() => expect(screen.getAllByRole('status').some((r) => r.textContent === 'Saved')).toBe(true));
  });
  it('leaving with edits asks first: Keep editing stays, Discard leaves', async () => {
    mount(<TeacherProfilePage />);
    fireEvent.change(await years(), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('site-home-link'));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
    fireEvent.click(screen.getByTestId('discard-keep'));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).toBeNull());
    expect(screen.queryByTestId('where')).toBeNull();
    fireEvent.click(screen.getByTestId('site-home-link'));
    fireEvent.click(await screen.findByTestId('discard-leave'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });
  it('with nothing changed there is no sheet: the link just goes', async () => {
    mount(<TeacherProfilePage />);
    await years();
    fireEvent.click(screen.getByTestId('site-home-link'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });
});

describe('Your areas: the ask sheet', () => {
  const writers = () => ({ fetchIntent: vi.fn(async () => ({ roles: [], declined: [] })), setIntent: vi.fn(async () => undefined), setDeclined: vi.fn(async () => ({})) });
  it('has Yes and Skip for now; Skip stores the same No as before', async () => {
    const w = writers();
    mount(<YourAreasPage writers={w as unknown as RoleWriters} />);
    await screen.findByTestId('area-row-dj');
    await act(async () => fireEvent.click(await screen.findByTestId('area-action-ask')));
    const sheet = await screen.findByTestId('do-you-dj');
    expect(sheet.textContent).toContain('Do you DJ?');
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(w.setDeclined).toHaveBeenCalledWith('dj', true));
    expect(w.setIntent).not.toHaveBeenCalled();
  });
});
