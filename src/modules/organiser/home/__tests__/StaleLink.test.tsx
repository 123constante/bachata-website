// @vitest-environment jsdom
/** C34: a link to a date that has passed shows eventState's past-date text verbatim with one button, Home. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { dateLock } from '@/modules/organiser/shared/eventState';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { StaleLink } from '../StaleLink';

afterEach(cleanup);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('StaleLink (C34)', () => {
  it('shows the eventState past-date text verbatim and one button that goes Home', () => {
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route path="/x" element={<StaleLink />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('stale-link-text').textContent).toBe('This date has already happened, so it can no longer be changed.');
    expect(screen.getByTestId('stale-link-text').textContent).toBe(dateLock('live', '2026-01-01', '2026-01-02'));
    // ONE Home target: no shell back link besides the button (N1).
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByTestId('org-back')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home);
  });
});
