// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import Done from '../Done';
import { goDone, type DoneState } from '../doneState';

afterEach(cleanup);

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(state: DoneState | null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: ORG_PATHS.done, state }]}>
      <Routes>
        <Route path={ORG_PATHS.done} element={<Done />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Done (D29, D49, D51, D61)', () => {
  it('shows the confirmation line and ONE button, Back to Home', () => {
    renderAt({ title: 'Moved', message: 'Moved to 20:00', seriesId: 's1' });
    expect(screen.getByText('Moved to 20:00')).toBeTruthy();
    const body = within(screen.getByTestId('org-done'));
    const buttons = body.getAllByRole('button').concat(body.queryAllByRole('link'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Back to Home']);
    expect(screen.queryByText(/undo/i)).toBeNull();
    fireEvent.click(screen.getByText('Back to Home'));
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home);
  });

  it('a `next` adds the second button (Cancel: Put it back)', () => {
    const next = ORG_PATHS.cancelDate('s1', 'o1');
    renderAt({ title: 'Cancelled', message: 'Cancelled - Tuesday 27 October', seriesId: 's1', next });
    const labels = within(screen.getByTestId('org-done')).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Back to Home', 'Put it back']);
    fireEvent.click(screen.getByText('Put it back'));
    expect(screen.getByTestId('where').textContent).toBe(next);
  });

  it('a `nextLabel` renames the second button (Team removal: Add them back, C26b)', () => {
    renderAt({ title: 'Removed', message: 'Removed from the team', seriesId: null, next: ORG_PATHS.teamAdd, nextLabel: 'Add them back' });
    const labels = within(screen.getByTestId('org-done')).getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['Back to Home', 'Add them back']);
    fireEvent.click(screen.getByText('Add them back'));
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.teamAdd);
  });

  it('a reload with no state goes Home', () => {
    renderAt(null);
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home);
  });

  it('goDone navigates to the Done route with the state', () => {
    const navigate = vi.fn();
    const state: DoneState = { title: 'Saved', message: 'Saved', seriesId: null };
    goDone(navigate, state);
    expect(navigate).toHaveBeenCalledWith(ORG_PATHS.done, { state });
  });
});
