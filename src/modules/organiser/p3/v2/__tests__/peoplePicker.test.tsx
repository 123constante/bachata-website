// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PeopleGroup } from '../PeopleGroup';
import { initialsOf, avatarColour } from '../PeoplePickerScreen';

const flagState = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', () => ({
  flags: new Proxy({}, { get: (_t, k) => (k === 'organiserPeoplePicker' || k === 'organiserP3' ? flagState.on : false) }),
}));
vi.mock('../../../dates/peoplePicker', async (orig) => ({
  ...(await orig<typeof import('../../../dates/peoplePicker')>()),
  searchPickerRows: vi.fn(async (term: string) =>
    term === 'zzz' ? [] : [
      { id: 'p1', name: 'Ana Lopez', sublabel: 'Teacher · Bristol', avatarUrl: 'https://x.test/a.jpg' },
      { id: 'p2', name: 'Ben', sublabel: 'Teacher', avatarUrl: null },
    ]),
}));

const mount = (over: Record<string, unknown> = {}) => {
  const onAdd = vi.fn(); const onRemove = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PeopleGroup label="Teachers" people={[]} role="teaching" onIds={new Set(['p2'])} onAdd={onAdd} onRemove={onRemove} {...over} />
    </QueryClientProvider>,
  );
  return { onAdd, onRemove };
};
beforeEach(() => { flagState.on = true; });
afterEach(cleanup);

describe('PeopleGroup, picker flag ON', () => {
  it('shows one add row instead of the text box and Add button', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Teachers add' }).textContent).toBe('+ Add a teacher');
    expect(screen.queryByPlaceholderText('Search by name')).toBeNull();
    expect(screen.getByText('None yet')).toBeTruthy();
  });
  it('opens full screen, searches, adds on tap and closes', async () => {
    const { onAdd } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Teachers add' }));
    const box = screen.getByPlaceholderText('Search by name');
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: 'a' } });
    expect(screen.queryByRole('option')).toBeNull();
    fireEvent.change(box, { target: { value: 'an' } });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(screen.getByTestId('avatar-photo')).toBeTruthy();
    fireEvent.click(screen.getByRole('option'));
    expect(onAdd).toHaveBeenCalledWith({ id: 'p1', name: 'Ana Lopez' });
    expect(screen.queryByTestId('people-picker')).toBeNull();
  });
  it('Back with nothing picked changes nothing', () => {
    const { onAdd } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Teachers add' }));
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByTestId('people-picker')).toBeNull();
  });
  it('says so when no one matches', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Teachers add' }));
    fireEvent.change(screen.getByPlaceholderText('Search by name'), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('No one found for that name.')).toBeTruthy());
  });
  it('chips carry an avatar; x removes; read-only chips have no x', () => {
    const { onRemove } = mount({ people: [{ id: 'a', name: 'Cy Dee', canRemove: true }, { id: 'b', name: 'Team Person', canRemove: false }] });
    expect(screen.getAllByTestId('avatar-initials')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Cy Dee' }));
    expect(onRemove).toHaveBeenCalledWith('a');
    expect(screen.queryByRole('button', { name: 'Remove Team Person' })).toBeNull();
  });
  it('a read-only group (role null) has no add row', () => {
    mount({ role: null });
    expect(screen.queryByRole('button', { name: 'Teachers add' })).toBeNull();
  });
});

describe('PeopleGroup, picker flag OFF', () => {
  it('keeps the inline search box and Add button', () => {
    flagState.on = false;
    mount();
    expect(screen.getByPlaceholderText('Search by name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Teachers add' })).toBeNull();
  });
});

describe('avatar helpers', () => {
  it('initials and a stable colour', () => {
    expect(initialsOf('Ana Maria Lopez')).toBe('AL');
    expect(initialsOf('Ben')).toBe('B');
    expect(avatarColour('p1')).toBe(avatarColour('p1'));
  });
});
