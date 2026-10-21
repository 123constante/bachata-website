// @vitest-environment jsdom
// ER-C8: the event page route's states: loading, the not-found split, a failed read with Try again.
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupMessages } from '@/modules/organiser/shared/eventRules';

const h = vi.hoisted(() => ({
  series: { state: 'loading' } as { state: string; retry?: () => void },
  ws: { data: undefined as unknown, isError: false, isFetching: false, refetch: vi.fn(), error: null },
  home: { data: undefined as unknown, isError: false, isFetching: false, refetch: vi.fn() },
  rebuild: true,
}));

vi.mock('../../shared/useOrganiserSeries', async (orig) => ({ ...(await orig<object>()), useOrganiserSeries: () => h.series }));
vi.mock('../eventsApi', async (orig) => ({ ...(await orig<object>()), useEventWorkspace: () => h.ws }));
vi.mock('@/modules/organiser/flows/add/useFlow', () => ({ useFlowHome: () => h.home }));
vi.mock('../../shell/rebuildSwitch', () => ({ useRebuildSwitch: () => h.rebuild }));
vi.mock('../EventPage', () => ({ EventPage: () => createElement('div', { 'data-testid': 'rebuilt-page' }) }));
vi.mock('../EventList', () => ({ EventList: () => null }));

import OneEvent from '../OneEvent';

function mount() {
  return render(createElement(MemoryRouter, { initialEntries: ['/e/s1'] }, createElement(Routes, null, createElement(Route, { path: '/e/:seriesId', element: createElement(OneEvent) }))));
}

beforeEach(() => {
  h.series = { state: 'loading' };
  h.ws = { data: undefined, isError: false, isFetching: false, refetch: vi.fn(), error: null };
  h.rebuild = true;
});
afterEach(cleanup);

describe('the rebuilt event route', () => {
  it('loading shows the skeleton, not Not found', () => {
    mount();
    expect(screen.getByTestId('org-event-loading')).toBeTruthy();
    expect(screen.queryByTestId('org-event-gone')).toBeNull();
  });

  it.each([
    ['not-found-archived', lookupMessages.notFoundArchived],
    ['no-access', lookupMessages.noAccess],
    ['gone', lookupMessages.gone],
  ])('%s says its own sentence', (state, text) => {
    h.series = { state };
    mount();
    expect(screen.getByTestId(`org-event-${state}`).textContent).toContain(text);
  });

  it('the three not-found sentences differ', () => {
    expect(new Set([lookupMessages.notFoundArchived, lookupMessages.noAccess, lookupMessages.gone]).size).toBe(3);
  });

  it('a failed read shows Try again, never Not found, and retry asks again', () => {
    const retry = vi.fn();
    h.series = { state: 'error', retry };
    mount();
    expect(screen.queryByTestId('org-event-gone')).toBeNull();
    fireEvent.click(within(screen.getByTestId('org-event-error')).getByRole('button'));
    expect(retry).toHaveBeenCalled();
    expect(h.ws.refetch).toHaveBeenCalled();
  });

  it('a found series with its workspace renders the page', () => {
    h.series = { state: 'found' };
    h.ws.data = { series: { id: 's1', version: 3 } };
    mount();
    expect(screen.getByTestId('rebuilt-page')).toBeTruthy();
  });
});
