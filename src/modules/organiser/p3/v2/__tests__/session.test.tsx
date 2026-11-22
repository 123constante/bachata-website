// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DraftPerson, DraftSession } from '../../../shared/programmeModel';
import { newSession } from '../../../shared/programmeModel';
import { SessionSheetV2, groupsFor, lostOnTypeChange, timesProblem } from '../SessionSheetV2';
import { V2 } from '../copy';

vi.mock('../../../dates/peoplePicker', async (orig) => ({
  ...(await orig<typeof import('../../../dates/peoplePicker')>()),
  searchPickerRows: vi.fn(async () => [{ id: 'p1', name: 'Ana', sublabel: 'Teacher' }, { id: 'p2', name: 'Ben', sublabel: 'Teacher' }]),
}));

const person = (id: string, name: string, role: string, origin: 'stored' | 'added' = 'added'): DraftPerson => ({ id, name, role, origin, removed: false });
const stored = (over: Partial<DraftSession> = {}): DraftSession => ({ key: 's1', original: { id: 's1' }, type: 'class', title: 'Salsa', start: '19:00', end: '20:00', levels: ['beginner'], removed: false, people: [], ...over });

function open(row: DraftSession | null, extra: { count?: number } = {}) {
  const onDone = vi.fn(); const onRemove = vi.fn(); const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SessionSheetV2 row={row} count={extra.count ?? 2} ctx="night" dayLabel="Thursday 26 November" onDone={onDone} onRemove={onRemove} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onDone, onRemove, onClose };
}
const btn = (n: string) => screen.getByRole('button', { name: n });
const set = (label: string, v: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('SessionSheetV2', () => {
  it('titles: new and existing', () => {
    open(null);
    expect(screen.getByRole('dialog', { name: 'Add a class or party' })).toBeTruthy();
  });
  it('existing title falls back to the type', () => {
    open(stored({ title: '' }));
    expect(screen.getByRole('dialog', { name: 'Class' })).toBeTruthy();
  });
  it('existing title shows its own title', () => {
    open(stored());
    expect(screen.getByRole('dialog', { name: 'Salsa' })).toBeTruthy();
  });
  it('type chips with aria-pressed; level chips for class only, multi-pick', () => {
    open(null);
    expect(btn('Class').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn('Beginner')); fireEvent.click(btn('Advanced'));
    expect(btn('Beginner').getAttribute('aria-pressed')).toBe('true');
    expect(btn('Advanced').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Open level' })).toBeNull();
    fireEvent.click(btn('Beginner'));
    expect(btn('Beginner').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn('Party'));
    expect(btn('Party').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Beginner' })).toBeNull();
  });
  it('group label per type', () => {
    open(null);
    expect(screen.getByText('Teachers')).toBeTruthy();
    fireEvent.click(btn('Masterclass')); expect(screen.getByText('Teachers')).toBeTruthy();
    fireEvent.click(btn('Party')); expect(screen.getByText('DJs')).toBeTruthy();
    fireEvent.click(btn('Performance')); expect(screen.getByText('Dancers')).toBeTruthy();
  });
  it('Performance dancers are show only', () => {
    open(newSession('performance'));
    expect(screen.getByText(V2.session.teamAdds)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
    expect(screen.getByText('None yet')).toBeTruthy();
  });
  it('Performance with a stored dancer: chip without x', () => {
    open(stored({ type: 'performance', levels: [], people: [person('d1', 'Dee', 'performing', 'stored')] }));
    expect(screen.getByText('Dee')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Dee' })).toBeNull();
  });
  it('None yet, Add disabled until picked, picked becomes a chip, not offered twice, x removes', async () => {
    open(newSession('class'));
    expect(screen.getByText('None yet')).toBeTruthy();
    expect((btn('Add') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Teachers search'), { target: { value: 'an' } });
    fireEvent.click(await screen.findByRole('option', { name: /Ana/ }));
    expect((btn('Add') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn('Add'));
    expect(within(screen.getByTestId('grp-Teachers')).getByText('Ana')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Teachers search'), { target: { value: 'an' } });
    await screen.findByRole('option', { name: /Ben/ });
    expect(screen.queryByRole('option', { name: /Ana/ })).toBeNull();
    fireEvent.click(btn('Remove Ana'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Ana' })).toBeNull());
    expect(screen.getByText('None yet')).toBeTruthy();
  });
  it('Party with old dancers: hint, no x, no second Add', () => {
    open(stored({ type: 'party', levels: [], people: [person('j', 'Jo', 'djing', 'stored'), person('d1', 'Dee', 'performing', 'stored')] }));
    expect(screen.getByText(V2.session.partyDancers)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1);
    expect(screen.getByText('Dee')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Jo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Dee' })).toBeNull();
  });
  it('type change warns and removes nothing until Done', () => {
    const row = { ...newSession('class'), levels: ['beginner', 'improver'], people: [person('p1', 'Ana', 'teaching')] };
    const { onDone } = open(row);
    fireEvent.click(btn('Party'));
    expect(screen.getByText('Ana, Beginner, Improver level will be removed.')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    set('Starts', '20:00'); set('Ends', '23:00');
    fireEvent.click(btn('Done'));
    const out = onDone.mock.calls[0][0] as DraftSession;
    expect(out.type).toBe('party');
    expect(out.levels).toEqual([]);
    expect(out.people ?? []).toEqual([]);
  });
  it('switching back clears the warning', () => {
    open({ ...newSession('class'), people: [person('p1', 'Ana', 'teaching')] });
    fireEvent.click(btn('Party')); fireEvent.click(btn('Class'));
    expect(screen.queryByText(/will be removed/)).toBeNull();
  });
  it('Done: error for empty, equal and end before start; stays open', () => {
    const { onDone } = open(newSession('class'));
    fireEvent.click(btn('Done'));
    expect(screen.getByText(V2.session.endsBefore)).toBeTruthy();
    set('Starts', '19:00'); set('Ends', '19:00'); fireEvent.click(btn('Done'));
    expect(screen.getByText(V2.session.endsBefore)).toBeTruthy();
    set('Ends', '18:00'); fireEvent.click(btn('Done'));
    expect(screen.getByText(V2.session.endsBefore)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
  it('Done: end before 06:00 is allowed; title defaults to the type label', () => {
    const { onDone } = open(newSession('party'));
    set('Starts', '22:00'); set('Ends', '02:00'); fireEvent.click(btn('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect((onDone.mock.calls[0][0] as DraftSession).title).toBe('Party');
  });
  it('Remove: disabled at count 1 with the hint; hands the row over otherwise; absent for new', () => {
    const a = open(stored(), { count: 1 });
    expect((btn('Remove this one') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(V2.session.needOne)).toBeTruthy();
    fireEvent.click(btn('Remove this one'));
    expect(a.onRemove).not.toHaveBeenCalled();
  });
  it('Remove calls onRemove at count 2', () => {
    const a = open(stored(), { count: 2 });
    fireEvent.click(btn('Remove this one'));
    expect(a.onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(V2.session.needOne)).toBeNull();
  });
  it('new session has no Remove', () => {
    open(null);
    expect(screen.queryByRole('button', { name: 'Remove this one' })).toBeNull();
  });
});

describe('pure helpers and copy', () => {
  it('groupsFor', () => {
    expect(groupsFor('class').map((g) => g.label)).toEqual(['Teachers']);
    expect(groupsFor('party').map((g) => g.label)).toEqual(['DJs']);
    expect(groupsFor('performance')[0]).toMatchObject({ label: 'Dancers', role: null });
    expect(groupsFor('party', [person('d', 'D', 'performing', 'stored')]).map((g) => g.label)).toEqual(['DJs', 'Dancers']);
  });
  it('lostOnTypeChange', () => {
    const r = { people: [person('a', 'Ana', 'teaching'), person('j', 'Jo', 'djing')], levels: ['beginner'] };
    expect(lostOnTypeChange(r, 'class')).toEqual(['Jo']);
    expect(lostOnTypeChange(r, 'party')).toEqual(['Ana', 'Beginner level']);
  });
  it('timesProblem', () => {
    expect(timesProblem('', '')).toBe(true);
    expect(timesProblem('19:00', '19:00')).toBe(true);
    expect(timesProblem('19:00', '18:00')).toBe(true);
    expect(timesProblem('22:00', '02:00')).toBe(false);
    expect(timesProblem('19:00', '20:00')).toBe(false);
  });
  it('toast builders', () => {
    expect(V2.session.savedNight('Thursday 26 November')).toBe('Saved for Thursday 26 November only');
    expect(V2.session.savedEvery('Thursday')).toBe('Saved for every Thursday');
    expect(V2.session.savedOneOff).toBe('Saved');
    expect(V2.session.willRemove('Ana')).toBe('Ana will be removed.');
  });
});
