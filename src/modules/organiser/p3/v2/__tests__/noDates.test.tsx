// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DatesSheet } from '../DatesSheet';

afterEach(cleanup);
const d = (id: string, occ: string) => ({ id, occurrence_date: occ, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0 }) as never;
const sheet = (dates: never[], onAdd = vi.fn(async () => ({ ok: true, error: null as string | null }))) =>
  render(<DatesSheet open dates={dates} seriesStatus="live" onPick={() => undefined} onClose={() => undefined} onAdd={onAdd} minDate="2026-11-22" />);

describe('DatesSheet empty state', () => {
  it('keep-list: with dates, no empty text and no add control (live and draft alike)', () => {
    for (const status of ['live', 'draft']) {
      cleanup();
      render(<DatesSheet open dates={[d('a', '2026-11-26')]} seriesStatus={status} onPick={() => undefined} onClose={() => undefined} onAdd={vi.fn()} />);
      expect(screen.getAllByTestId('dates-row')).toHaveLength(1);
      expect(screen.queryByTestId('dates-empty')).toBeNull();
      expect(screen.queryByTestId('dates-add-go')).toBeNull();
    }
  });
  it('no dates: says so and the button stays disabled until a date is picked, then adds it', async () => {
    const onAdd = vi.fn(async () => ({ ok: true, error: null as string | null }));
    sheet([], onAdd);
    expect(screen.getByTestId('dates-empty').textContent).toBe('No upcoming dates.');
    const go = screen.getByTestId('dates-add-go') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('dates-add-input'), { target: { value: '2026-12-03' } });
    fireEvent.click(go);
    expect(onAdd).toHaveBeenCalledWith('2026-12-03');
  });
});
