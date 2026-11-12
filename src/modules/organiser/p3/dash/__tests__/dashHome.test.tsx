// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDash, type DashInput, type ProfileStep } from '../dashModel';

const h = vi.hoisted(() => ({
  analytics: { isLoading: false, isError: false, data: undefined as unknown, refetch: () => undefined },
  progress: { data: undefined as unknown },
}));
vi.mock('../../data/useP3Data', () => ({ useP3Analytics: () => h.analytics }));
vi.mock('../../../shared/profileProgress', () => ({ useProfileProgress: () => h.progress }));

import { DashHome } from '../DashHome';

const row = {
  id: 's1', name: 'Ritmo', publicEventRef: 'ritmo', upcoming: 1, nextTime: '8pm', nextStart: '20:00',
  next: { date: '2099-12-11', status: 'scheduled' },
  event: { dates: [{ date: '2099-12-11', status: 'scheduled' }] },
} as never;
const page = { id: 'p1', name: 'Page', role: 'owner', team: [] } as never;
const mount = () => render(<MemoryRouter><DashHome rows={[row]} today="2099-12-01" page={page} seriesIds={new Set(['s1'])} /></MemoryRouter>);

beforeEach(() => { h.analytics = { isLoading: false, isError: false, data: undefined, refetch: () => undefined }; h.progress = { data: undefined }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('DashHome', () => {
  it('2: a slow analytics read does not blank Home', () => {
    h.analytics = { ...h.analytics, isLoading: true };
    mount();
    expect(screen.getByTestId('dash-share-page')).toBeTruthy();
    expect(screen.getByTestId('dash-rail')).toBeTruthy();
  });

  it('4: a stale "Link copied" notice clears when a later native share succeeds', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mount();
    await act(async () => { fireEvent.click(screen.getByTestId('dash-share-page')); });
    await waitFor(() => expect(screen.getByTestId('dash-share-notice').textContent).toMatch(/Link copied/));
    vi.stubGlobal('navigator', { share: vi.fn().mockResolvedValue(undefined) });
    await act(async () => { fireEvent.click(screen.getByTestId('dash-share-page')); });
    await waitFor(() => expect(screen.queryByTestId('dash-share-notice')).toBeNull());
  });
});

describe('1: profile card never claims complete without steps', () => {
  const step = (key: 'bio' | 'logo', done: boolean): ProfileStep => ({ key, label: key, sentence: 'Do it.', button: 'Add', done });
  const base: DashInput = { load: 'ready', seat: 'owner', nights: [], upcomingDates: 0, pageLink: 'x', profileSteps: [], cityOrganisers: null, cityAverage: null, sellingViaUs: false, teamCount: 1 };
  const cases: Array<[string, ProfileStep[], boolean | null]> = [
    ['empty / loading / failed', [], null],
    ['partial', [step('bio', true), step('logo', false)], false],
    ['none done', [step('bio', false), step('logo', false)], false],
    ['complete', [step('bio', true), step('logo', true)], true],
  ];
  it.each(cases)('%s', (_n, profileSteps, complete) => {
    const p = buildDash({ ...base, profileSteps }).profile;
    expect(p === null ? null : p.complete).toBe(complete);
  });
});
