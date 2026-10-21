// @vitest-environment jsdom
/**
 * RELEASE B (web) seams (a) and (b): a brand-new sign-up who chose Teacher or DJ
 * (no record yet) lands on a page that says what they can do, and Your areas lists
 * every role with the sign-up choice reachable. Prod-shaped fake server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: (...a: unknown[]) => h.rpc(...a), from: vi.fn() } }));

import TeacherAreaPage from '../teacher/TeacherAreaPage';
import DjAreaPage from '../dj/DjAreaPage';
import YourAreasPage from '../home/YourAreasPage';
import { LINEUP_EMPTY_BODY, LINEUP_EMPTY_TITLE } from '../shared/LineupList';
import { AREA_ROLES } from '../home/rolesApi';
import { SwitcherAreas } from '../home/SwitcherAreas';
import { AREA_HREF, NOT_HELD_WORDS, OPEN_LABEL } from '../home/areaStatus';
import { requiredLeftText } from '@/modules/organiser/shared/profileProgress';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const EMPTY = {
  teacher: { years_teaching: null, teaching_styles: [], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null },
  dj: { dj_name: null, genres: [], soundcloud: null, mixcloud: null, pricing: null },
};
/**
 * The PROD shape of a sign-up that ticked Dancer + Teacher and saved nothing yet (B1): my_roles_v1 says teacher
 * `active:false` (only a person_roles row makes it active), while my_profile_progress_v1 already lists the seven
 * teacher steps from the intent (D40), all optional and open. DJ was not chosen: no DJ steps.
 */
const TEACHER_STEPS = Object.keys(EMPTY.teacher).map((field) => ({ area: 'teacher', field, required: false, done: false }));
const PROD_PROGRESS = {
  percent: 20,
  required_left: 1,
  publish_ready: false,
  steps: [{ area: 'dancer', field: 'dance_role', required: true, done: false }, { area: 'dancer', field: 'first_name', required: true, done: true }, ...TEACHER_STEPS],
  declined: [],
};
beforeEach(() => {
  h.rpc.mockReset().mockImplementation((fn: string, args?: { p_role?: 'teacher' | 'dj' }) => {
    if (fn === 'my_role_details_v1') return ok({ role: args!.p_role, person_id: 'p1', details: EMPTY[args!.p_role!] });
    if (fn === 'my_lineup_appearances_v1') return ok([]);
    if (fn === 'my_roles_v1') return ok([
      { role: 'dancer', active: true, complete: false },
      { role: 'teacher', active: false, complete: false },
      { role: 'dj', active: false, complete: false },
    ]);
    if (fn === 'my_profile_progress_v1') return ok(PROD_PROGRESS);
    return Promise.resolve({ data: null, error: { message: `unexpected ${fn}` } });
  });
});
afterEach(cleanup);

function mount(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

describe('(a) a new sign-up who chose Teacher / DJ: the area renders an empty state with ONE action', () => {
  it.each([
    ['teacher', <TeacherAreaPage />, 'No details added yet'],
    ['dj', <DjAreaPage />, 'No details added yet'],
  ] as [string, ReactElement, string][])('%s', async (_role, ui, line) => {
    mount(ui);
    expect((await screen.findByTestId('completeness-line')).textContent).toBe(line);
    // The one action, in words; the line-up card says what will fill it.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit details']);
    expect(await screen.findByText(LINEUP_EMPTY_TITLE)).toBeTruthy();
    expect(screen.getByText(LINEUP_EMPTY_BODY)).toBeTruthy();
    expect(screen.queryByTestId('blocked-state')).toBeNull();
    expect(screen.queryByTestId('details-error')).toBeNull();
  });
});

describe('(b) Your areas for the same new person (chose Dancer + Teacher at sign-up)', () => {
  const sevenLeft = requiredLeftText(TEACHER_STEPS.length);

  it('lists every role, each with one action; the chosen Teacher reads the open count with Open, DJ reads "Not added" with Add', async () => {
    mount(<YourAreasPage />);
    await waitFor(() => expect(screen.getByTestId('area-status-teacher').textContent).toBe(sevenLeft));
    for (const role of AREA_ROLES) {
      const row = screen.getByTestId(`area-row-${role}`);
      expect(within(row).queryAllByRole('link').length + within(row).queryAllByRole('button').length).toBe(1);
    }
    const teacher = screen.getByTestId('area-row-teacher');
    expect(within(teacher).getByRole('link', { name: OPEN_LABEL }).getAttribute('href')).toBe(AREA_HREF.teacher);
    expect(screen.getByTestId('area-status-dj').textContent).toBe(NOT_HELD_WORDS);
    expect(screen.getAllByTestId('area-action-ask').map((b) => b.textContent)).toEqual(['Add']);
  });

  it('the Switch profile sheet says the same words for Teacher and lists no DJ entry', async () => {
    mount(<SwitcherAreas rowClass="" mutedClass="" onPick={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('profile-switcher-area-status-teacher').textContent).toBe(sevenLeft));
    expect(screen.getByTestId('profile-switcher-area-teacher').getAttribute('href')).toBe(AREA_HREF.teacher);
    expect(screen.queryByTestId('profile-switcher-area-dj')).toBeNull();
  });
});
