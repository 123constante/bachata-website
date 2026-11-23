// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PeoplePickerScreen } from '../PeoplePickerScreen';
import { groupTeachers } from '../../../dates/teacherList';

const row = (id: string, name: string) => ({ id, name, sublabel: '', avatarUrl: null });
const ROWS = [row('c', 'Cleo'), row('a', 'Ana'), row('b', 'Ben'), row('d', 'Dan')];

vi.mock('@/lib/featureFlags', () => ({ flags: new Proxy({}, { get: (_t, k) => k === 'organiserPickerList' }) }));
vi.mock('../../../dates/teacherList', async (orig) => ({ ...(await orig<typeof import('../../../dates/teacherList')>()), fetchAllTeacherRows: vi.fn(async () => ROWS) }));
vi.mock('../../../dates/peoplePicker', async (orig) => ({
  ...(await orig<typeof import('../../../dates/peoplePicker')>()),
  searchPickerRows: vi.fn(async () => [row('a', 'Ana')]),
}));
afterEach(cleanup);

describe('groupTeachers keep-list', () => {
  it('team first, rest A to Z, no duplicates, on-session ids dropped', () => {
    const g = groupTeachers(ROWS, new Set(['c', 'b']), new Set(['d']));
    expect(g.team.map((r) => r.name)).toEqual(['Ben', 'Cleo']);
    expect(g.all.map((r) => r.name)).toEqual(['Ana']);
  });
});

describe('PeoplePickerScreen, list flag ON', () => {
  const mount = (teamIds: Set<string>) => {
    const onPick = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><PeoplePickerScreen role="teaching" onIds={new Set()} teamIds={teamIds} onPick={onPick} onBack={() => undefined} /></QueryClientProvider>);
    return onPick;
  };
  it('shows both headers and name-only rows; tap picks', async () => {
    const onPick = mount(new Set(['b']));
    expect(await screen.findByText('On your team')).toBeTruthy();
    expect(screen.getByText('All teachers')).toBeTruthy();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ben', 'Ana', 'Cleo', 'Dan']);
    fireEvent.click(screen.getByRole('option', { name: 'Ben' }));
    expect(onPick).toHaveBeenCalledWith(ROWS[2]);
  });
  it('hides team header with no team; typing drops headers', async () => {
    mount(new Set());
    await screen.findByText('All teachers');
    expect(screen.queryByText('On your team')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search by name'), { target: { value: 'an' } });
    expect(await screen.findAllByRole('option')).toHaveLength(1);
    expect(screen.queryByText('All teachers')).toBeNull();
  });
});
