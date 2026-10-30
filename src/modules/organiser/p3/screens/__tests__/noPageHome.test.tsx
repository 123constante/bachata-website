// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { P3_PATHS } from '../../shell/paths';

const homeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => homeQ.value, useP3Views: () => ({ isPending: true }) }));
vi.mock('@/modules/going/useMyOrganiserGoingTotal', () => ({ useMyOrganiserGoingTotal: () => ({ view: { state: 'off' }, total: null }) }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));
import { HomeScreen } from '../HomeScreen';

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

describe('P3 Home with no page (e.g. P3 "Asked to join" -> Go to Home)', () => {
  it('lands on the rebuilt P3 Welcome, not the R1 onboarding at /you/add', () => {
    homeQ.value = { isPending: false, isError: false, isFetching: false, data: { organisers: [] }, refetch: vi.fn() };
    render(
      <MemoryRouter initialEntries={[P3_PATHS.home]}>
        <Routes>
          <Route path={P3_PATHS.home} element={<HomeScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.start);
  });
});
