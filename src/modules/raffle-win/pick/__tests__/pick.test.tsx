// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OpenNight } from '../../model';
import { PickScreen } from '../PickScreen';
import { REFUSAL_LINES, type PickRefusal } from '../pickCopy';
import { applyRefusal, formatPickDate, groupNights, type PickSelection } from '../pickModel';

afterEach(cleanup);

const n = (id: string, ev: string | null, title: string, start: string, venue = 'Bar Luna', poster: string | null = null): OpenNight => ({
  occurrenceId: id, title, startLocal: start, venueName: venue, posterUrl: poster, publicEventId: ev,
});
const NIGHTS = [
  n('a1', 'e1', 'Sensual Thursdays', '2026-11-26T20:00:00', 'Bar Luna', 'https://x/f.jpg'),
  n('a2', 'e1', 'Sensual Thursdays', '2026-12-03T20:00:00', 'Bar Luna', 'https://x/f.jpg'),
  n('b1', 'e2', 'Winter Ball', '2026-12-19T19:00:00', 'Assembly Hall'),
  n('c1', 'e3', '', '2026-11-27T21:00:00', 'Tram Shed'),
];

function Harness({ onLock = () => {}, banner = null }: { onLock?: (x: OpenNight) => void; banner?: PickRefusal | null }) {
  const [sel, setSel] = useState<PickSelection>(null);
  return <PickScreen nights={NIGHTS} selection={sel} banner={banner} onSelect={setSel} onLock={onLock} />;
}
const lockBtn = () => screen.getByRole('button', { name: 'Lock this night' });

describe('pickModel', () => {
  it('formats dates with no time', () => {
    expect(formatPickDate('2026-11-26T20:00:00')).toBe('Thursday 26 Nov');
  });
  it('groups by public_event_id; a null id is its own event', () => {
    const g = groupNights([...NIGHTS, n('z', null, 'Solo', '2026-12-01T20:00:00')]);
    expect(g.map((e) => e.dates.length)).toEqual([2, 1, 1, 1]);
    expect(g[2].title).toBe('Bachata night');
  });
  it('refusals remove the right things and clear the selection', () => {
    const night = NIGHTS[0];
    expect(applyRefusal(NIGHTS, 'spot_taken', night).nights.map((x) => x.occurrenceId)).toEqual(['a2', 'b1', 'c1']);
    expect(applyRefusal(NIGHTS, 'night_not_open', night).nights).toHaveLength(3);
    expect(applyRefusal(NIGHTS, 'already_been_to_event', night).nights.map((x) => x.occurrenceId)).toEqual(['b1', 'c1']);
    const kept = applyRefusal(NIGHTS, 'honesty_required', night);
    expect(kept.nights).toHaveLength(4);
    expect(kept.selection).toBeNull();
  });
});

describe('PickScreen keep-list', () => {
  it('static copy, search aria, disabled lock', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Pick your night' })).toBeTruthy();
    expect(screen.getByText('Only nights you have never been to. Once you lock one, only the organiser can change it.')).toBeTruthy();
    const q = screen.getByLabelText('Search event or venue') as HTMLInputElement;
    expect(q.placeholder).toBe('Search event or venue');
    expect(screen.getByTestId('pick-dock-line').textContent).toBe('Tap an event, then choose a date');
    expect(lockBtn().getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByText('Show at the door')).toBeNull();
    expect(screen.getAllByTestId('pick-flyer-fallback')).toHaveLength(2);
  });
  it('search filters by event or venue; empty state clears', () => {
    render(<Harness />);
    const q = screen.getByLabelText('Search event or venue');
    fireEvent.change(q, { target: { value: 'assembly' } });
    expect(screen.getAllByTestId('pick-event')).toHaveLength(1);
    fireEvent.change(q, { target: { value: 'zzz' } });
    expect(screen.getByText('No event or venue matches.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByTestId('pick-event')).toHaveLength(3);
  });
  it('title fallback, dates head, chips, selection, dock line, lock', () => {
    const onLock = vi.fn();
    render(<Harness onLock={onLock} />);
    expect(screen.getByText('Bachata night')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sensual Thursdays/ }));
    expect(screen.getByText('Which date?')).toBeTruthy();
    fireEvent.click(lockBtn());
    expect(onLock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Thursday 26 Nov' }));
    expect(screen.getByTestId('pick-dock-line').textContent).toBe('Sensual Thursdays, Thursday 26 Nov');
    expect(lockBtn().getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Sensual Thursdays/ }));
    expect(screen.getByTestId('pick-date-line').textContent).toBe('Thursday 26 Nov');
    fireEvent.click(lockBtn());
    expect(onLock).toHaveBeenCalledWith(NIGHTS[0]);
  });
  it('one-off event auto-selects its only date', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Winter Ball/ }));
    expect(screen.getByText('One date only')).toBeTruthy();
    expect(screen.getByTestId('pick-dock-line').textContent).toBe('Winter Ball, Saturday 19 Dec');
  });
  it.each(Object.keys(REFUSAL_LINES) as PickRefusal[])('banner %s shows its line', (r) => {
    render(<Harness banner={r} />);
    expect(screen.getByTestId('pick-banner').textContent).toBe(REFUSAL_LINES[r]);
  });
  it('refusal copy is verbatim', () => {
    expect(REFUSAL_LINES.spot_taken).toBe('Someone else just took that night. Pick another.');
    expect(REFUSAL_LINES.already_been_to_event).toBe('Our records say you have been to that event, so it is not open to you. Pick another.');
    expect(REFUSAL_LINES.night_not_open).toBe('That night is no longer open. Pick another.');
    expect(REFUSAL_LINES.honesty_required).toBe('Please tick the box to confirm.');
  });
});
