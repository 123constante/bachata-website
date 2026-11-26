import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockFlags = vi.hoisted(() => ({
  peopleChips: true,
  teachersDirectory: true,
  organisersDirectory: true,
}));
vi.mock('@/lib/featureFlags', () => ({ flags: mockFlags }));

import { PeopleChips, peopleChipRows } from '../PeopleChips';

const OPEN = { teachers: true, organisers: true };

const CASES: Array<[string, string]> = [
  ['/all-profiles', 'all'],
  ['/dancers', 'dancers'],
  ['/djs', 'djs'],
  ['/teachers', 'teachers'],
  ['/organisers', 'organisers'],
  ['/venues', 'venues'],
  ['/vendors', 'vendors'],
  ['/videographers', 'video'],
  ['/city/london-gb/teachers', 'teachers'],
  ['/city/london-gb/venues', 'venues'],
];

describe('peopleChipRows', () => {
  it.each(CASES)('%s selects only %s', (path, id) => {
    const selected = peopleChipRows(path, OPEN).filter((r) => r.selected);
    expect(selected.map((r) => r.id)).toEqual([id]);
  });

  it('selects none on an unrelated path', () => {
    expect(peopleChipRows('/festivals', OPEN).some((r) => r.selected)).toBe(false);
  });

  it('keeps the listed order and hrefs', () => {
    expect(peopleChipRows('/djs', OPEN).map((r) => [r.id, r.label, r.href])).toEqual([
      ['all', 'All', '/all-profiles'],
      ['dancers', 'Dancers', '/dancers'],
      ['djs', 'DJs', '/djs'],
      ['teachers', 'Teachers', '/teachers'],
      ['organisers', 'Organisers', '/organisers'],
      ['venues', 'Venues', '/venues'],
      ['vendors', 'Vendors', '/vendors'],
      ['video', 'Video', '/videographers'],
    ]);
  });

  it('omits teachers and organisers when closed, includes them when open', () => {
    const closed = peopleChipRows('/djs', { teachers: false, organisers: false }).map((r) => r.id);
    expect(closed).not.toContain('teachers');
    expect(closed).not.toContain('organisers');
    expect(closed).toHaveLength(6);
    const open = peopleChipRows('/djs', OPEN).map((r) => r.id);
    expect(open).toContain('teachers');
    expect(open).toContain('organisers');
  });
});

describe('PeopleChips', () => {
  it('renders nothing when the flag is off', () => {
    mockFlags.peopleChips = false;
    const { container } = render(
      <MemoryRouter initialEntries={['/djs']}>
        <PeopleChips />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
    mockFlags.peopleChips = true;
  });

  it('renders 8 links with hrefs and aria-current on DJs only', () => {
    render(
      <MemoryRouter initialEntries={['/djs']}>
        <PeopleChips />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/all-profiles', '/dancers', '/djs', '/teachers', '/organisers', '/venues', '/vendors', '/videographers',
    ]);
    const current = links.filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('DJs');
  });
});
