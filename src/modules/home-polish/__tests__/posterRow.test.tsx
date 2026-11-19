// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PosterRow, nextPosterSel, type PosterSel } from '../PosterRow';

afterEach(cleanup);

const geo = { status: 'idle' as const, request: () => {}, clear: () => {} };

describe('nextPosterSel', () => {
  it('selects one at a time; tapping the selected word returns to All', () => {
    expect(nextPosterSel('all', 'party')).toBe('party');
    expect(nextPosterSel('party', 'class')).toBe('class');
    expect(nextPosterSel('party', 'party')).toBe('all');
    expect(nextPosterSel('near', 'near')).toBe('all');
    expect(nextPosterSel('class', 'near')).toBe('near');
    expect(nextPosterSel('class', 'all')).toBe('all');
  });
});

describe('PosterRow', () => {
  it('renders All, Near me, Party, Class, Fest with exactly one pressed', () => {
    render(<PosterRow geo={geo} sel="party" onSelect={() => {}} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['All', 'Near me', 'Party', 'Class', 'Festival']);
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
  });
  it('tap reports the next selection', () => {
    const onSelect = vi.fn<(s: PosterSel) => void>();
    render(<PosterRow geo={geo} sel="party" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Party'));
    expect(onSelect).toHaveBeenLastCalledWith('all');
    fireEvent.click(screen.getByText('Class'));
    expect(onSelect).toHaveBeenLastCalledWith('class');
  });
});
