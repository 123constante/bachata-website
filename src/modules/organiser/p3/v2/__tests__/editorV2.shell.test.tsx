// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';
import { EditorV2 } from '../EditorV2';
import { V2Sheet } from '../V2Sheet';

vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));

const date = (id: string, d: string, extra: Record<string, unknown> = {}) => ({
  id, occurrence_date: d, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, ...extra,
});
const ws = (format: string, dates: unknown[]) => ({ series: { id: 's1', format, name: 'Thursdays', lifecycle_status: 'live' }, dates }) as unknown as EventWorkspace;
const weeklyDates = ['2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24', '2026-12-31', '2027-01-07'].map((d, i) =>
  date(`o${i}`, d, i === 1 ? { lifecycle_status: 'cancelled' } : i === 2 ? { has_override: true } : {}));
function Where() { const l = useLocation(); return <output data-testid="where">{l.search}</output>; }
const at = (w: EventWorkspace, url = '/e') => render(<MemoryRouter initialEntries={[url]}><EditorV2 ws={w} /><Where /></MemoryRouter>);
afterEach(cleanup);

describe('EditorV2', () => {
  it('weekly: tabs use the weekday, 6 chips + More dates, tags, title', () => {
    at(ws('recurring', weeklyDates));
    expect(screen.getByTestId('ev2-tab-every').textContent).toBe('Every Thursday');
    expect(screen.getAllByTestId('ev2-chip')).toHaveLength(6);
    expect(screen.getByTestId('ev2-more-dates')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('Changed')).toBeTruthy();
    expect(screen.getByTestId('ev2-title').textContent).toBe('Thursday 26 November');
    expect(document.querySelector('[data-ev2-slot="night"]')).toBeTruthy();
  });
  it('chip pick sets ?night= and keeps the tab; tab every drops chips', () => {
    at(ws('recurring', weeklyDates), '/e?tab=every');
    expect(screen.queryByTestId('ev2-chips')).toBeNull();
    expect(screen.getByTestId('ev2-title').textContent).toBe('Every Thursday');
    fireEvent.click(screen.getByTestId('ev2-tab-night'));
    fireEvent.click(screen.getAllByTestId('ev2-chip')[2]);
    expect(screen.getByTestId('where').textContent).toBe('?night=o2');
    expect(screen.getByTestId('ev2-title').textContent).toBe('Thursday 10 December');
    fireEvent.click(screen.getByTestId('ev2-tab-every'));
    expect(screen.getByTestId('where').textContent).toContain('tab=every');
    expect(screen.getByTestId('where').textContent).toContain('night=o2');
  });
  it('one-off: no tabs, no chips, long date title', () => {
    at(ws('one_off', [date('o9', '2026-12-05')]));
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByTestId('ev2-chips')).toBeNull();
    expect(screen.getByTestId('ev2-title').textContent).toBe('Saturday 5 December');
  });
});

describe('V2Sheet', () => {
  it('closes on x, scrim and Escape and does nothing else', () => {
    const close = vi.fn();
    render(<V2Sheet open title="All dates" onClose={close}><button type="button">in</button></V2Sheet>);
    expect(screen.getByRole('dialog', { name: 'All dates' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByTestId('v2-sheet-scrim'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(3);
  });
  it('renders nothing when closed', () => {
    render(<V2Sheet open={false} title="x" onClose={() => undefined} />);
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
});
