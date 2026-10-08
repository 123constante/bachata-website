// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { NESTED_SHEET_ERROR, SearchField, SheetView } from '../ui';

afterEach(cleanup);

function LineupHarness() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'search'>('list');
  const [q, setQ] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)}>Open line-up</button>
      <SheetView
        open={open}
        onOpenChange={setOpen}
        title={view === 'list' ? 'Line-up' : 'Add a teacher'}
        viewKey={view}
        onBack={view === 'search' ? () => setView('list') : undefined}
        fullHeight
        footer={<button>Done</button>}
      >
        {view === 'list' ? (
          <button onClick={() => setView('search')}>Add teacher</button>
        ) : (
          <SearchField value={q} onChange={setQ} aria-label="Search teachers" autoFocusInSheet testId="q" />
        )}
      </SheetView>
    </>
  );
}

describe('SheetView', () => {
  it('swaps list and search inside ONE dialog and focuses the search field', async () => {
    render(<LineupHarness />);
    fireEvent.click(screen.getByText('Open line-up'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('org-sheet-title').textContent).toBe('Line-up');
    fireEvent.click(screen.getByText('Add teacher'));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByTestId('org-sheet-title').textContent).toBe('Add a teacher');
    expect(document.activeElement).toBe(screen.getByTestId('q'));
    expect(screen.getByTestId('org-sheet-footer').textContent).toBe('Done');
  });

  it('Escape goes back from a sub-view, then closes, and focus returns to the opener', async () => {
    render(<LineupHarness />);
    const opener = screen.getByText('Open line-up');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByText('Add teacher'));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('org-sheet-title').textContent).toBe('Line-up');
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('refuses a sheet nested inside a sheet', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <SheetView open onOpenChange={() => {}} title="Outer">
          <SheetView open onOpenChange={() => {}} title="Inner">
            <p>no</p>
          </SheetView>
        </SheetView>,
      ),
    ).toThrow(NESTED_SHEET_ERROR);
    err.mockRestore();
  });
});
