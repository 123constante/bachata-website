// @vitest-environment jsdom
// ER-FIX2-S2: audit findings F-C4-1..7 and F-C4-10 on the sheet and card.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { SessionSheet } from '../SessionSheet';
import { fromStored, newSession, type SessionDraft, type SessionPerson, type StoredSessionRow } from '../sessionsModel';

afterEach(cleanup);

type Search = (term: string, role: 'teaching' | 'djing') => Promise<SessionPerson[]>;

function Harness({ initial, onSave, search, max }: { initial: SessionDraft[]; onSave?: (l: SessionDraft[]) => void; search?: Search; max?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit sessions</button>
      {open && (
        <SessionSheet
          open
          onOpenChange={setOpen}
          sessions={initial}
          onSave={onSave ?? (() => undefined)}
          search={search ?? (async () => [])}
          recent={[]}
          onRecentChange={() => undefined}
          max={max}
        />
      )}
    </>
  );
}

const open = () => fireEvent.click(screen.getByText('Edit sessions'));
const row = (patch: Partial<StoredSessionRow>): StoredSessionRow => ({
  id: 'r1', type: 'party', title: null, start_time: '21:00:00', end_time: '02:00:00', room: null, level_keys: null, ...patch,
});
const selected = (el: HTMLElement) => {
  const s = el as HTMLSelectElement;
  return s.options[s.selectedIndex]?.textContent;
};

describe('F-C4-1: an untimed stored session is not an error', () => {
  it('Start reads "No set time"; no reason line, nothing announced', async () => {
    render(<Harness initial={[fromStored(row({ start_time: null, end_time: null }))]} />);
    open();
    const start = await screen.findByTestId('session-start');
    expect((start as HTMLSelectElement).value).toBe('');
    expect(selected(start)).toBe('No set time');
    expect(screen.queryByTestId('session-issues')).toBeNull();
  });
});

describe('F-C4-2: back to "No set time"', () => {
  it('a timed party can be set back to untimed and saved', async () => {
    const onSave = vi.fn();
    render(<Harness initial={[fromStored(row({}))]} onSave={onSave} />);
    open();
    fireEvent.change(await screen.findByTestId('session-start'), { target: { value: '' } });
    expect((screen.getByTestId('session-start') as HTMLSelectElement).value).toBe('');
    expect((screen.getByTestId('session-end') as HTMLSelectElement).disabled).toBe(true);
    const done = screen.getByTestId('sessions-done') as HTMLButtonElement;
    expect(done.disabled).toBe(false);
    fireEvent.click(done);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0][0]).toMatchObject({ start: '', end: '' });
  });
});

describe('F-C4-3: start set, end null', () => {
  it('End shows "Pick an end", not a false 20:15', async () => {
    render(<Harness initial={[fromStored(row({ start_time: '20:00:00', end_time: null }))]} />);
    open();
    const end = await screen.findByTestId('session-end');
    expect((end as HTMLSelectElement).value).toBe('');
    expect(selected(end)).toBe('Pick an end');
    fireEvent.change(end, { target: { value: '23:00' } });
    expect((screen.getByTestId('session-end') as HTMLSelectElement).value).toBe('23:00');
  });
});

describe('F-C4-4: a failed line-up search', () => {
  it('says "Search failed" with Retry, never "No one called X"; Retry searches again', async () => {
    let fail = true;
    const search = vi.fn(async (): Promise<SessionPerson[]> => {
      if (fail) throw new Error('offline');
      return [{ id: 'p1', name: 'Marta' }];
    });
    render(<Harness initial={[newSession('class', '19:00', 'a')]} search={search} />);
    open();
    fireEvent.change(await screen.findByTestId('lineup-search'), { target: { value: 'Mar' } });
    expect(await screen.findByTestId('lineup-failed', {}, { timeout: 2000 })).toHaveProperty('textContent', expect.stringContaining('Search failed'));
    expect(screen.queryByTestId('lineup-none')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('hit-p1')).toBeTruthy();
    expect(screen.queryByTestId('lineup-failed')).toBeNull();
    expect(search).toHaveBeenCalledTimes(2);
  });
});

describe('F-C4-5: time order while editing', () => {
  it('moving Session 2 before Session 1 re-orders the list straight away', async () => {
    render(<Harness initial={[newSession('class', '20:00', 'a'), newSession('party', '21:00', 'b')]} />);
    open();
    const order = () => screen.getAllByTestId(/^session-[ab]$/).map((el) => el.getAttribute('data-testid'));
    await screen.findByTestId('session-b');
    expect(order()).toEqual(['session-a', 'session-b']);
    fireEvent.change(within(screen.getByTestId('session-b')).getByTestId('session-start'), { target: { value: '19:00' } });
    expect(order()).toEqual(['session-b', 'session-a']);
  });
});

describe('F-C4-6: no control vanishes without a reason', () => {
  it('at the cap, Add another is disabled and says why', async () => {
    render(<Harness initial={[newSession('class', '19:00', 'a'), newSession('party', '20:00', 'b')]} max={2} />);
    open();
    const add = (await screen.findByTestId('sessions-add')) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.getByTestId('sessions-add-reason').textContent).toBe('2 is the most');
  });
  it('the only session keeps a disabled Remove with its reason', async () => {
    render(<Harness initial={[newSession('class', '19:00', 'a')]} />);
    open();
    const rm = (await screen.findByTestId('session-a-remove')) as HTMLButtonElement;
    expect(rm.disabled).toBe(true);
    const id = rm.getAttribute('aria-describedby');
    expect(document.getElementById(id as string)?.textContent).toBe('One session needed');
  });
});

describe('F-C4-7: the room Remove clears every session', () => {
  const withRoom = (id: string, room: string, start: string) => ({ ...newSession('class', start, id), room });
  it('says so, and asks first when more than one session holds a room', async () => {
    render(<Harness initial={[withRoom('a', 'Studio 1', '19:00'), withRoom('b', 'Studio 2', '20:00')]} />);
    open();
    const rm = (await screen.findAllByTestId('room-remove'))[0];
    expect(rm.textContent).toBe('Remove rooms');
    fireEvent.click(rm);
    expect(screen.getByTestId('room-remove-confirm').textContent).toContain('2 sessions');
    expect((screen.getAllByTestId('session-room')[1] as HTMLInputElement).value).toBe('Studio 2');
    fireEvent.click(screen.getByRole('button', { name: 'Keep rooms' }));
    expect(screen.getAllByTestId('session-room')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('room-remove')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear rooms' }));
    expect(screen.queryAllByTestId('session-room')).toHaveLength(0);
  });
  it('one room only: clears straight away', async () => {
    render(<Harness initial={[withRoom('a', 'Studio 1', '19:00'), newSession('party', '20:00', 'b')]} />);
    open();
    fireEvent.click((await screen.findAllByTestId('room-remove'))[0]);
    expect(screen.queryAllByTestId('session-room')).toHaveLength(0);
  });
});

describe('F-C4-10: leaving with unsaved changes', () => {
  it('Escape after a change asks first; Keep editing stays, Leave closes without saving', async () => {
    const onSave = vi.fn();
    render(<Harness initial={[newSession('party', '22:00', 'a')]} onSave={onSave} />);
    open();
    fireEvent.change(await screen.findByTestId('session-name'), { target: { value: 'Late party' } });
    fireEvent.keyDown(screen.getByTestId('session-name'), { key: 'Escape' });
    expect(await screen.findByTestId('sessions-leave')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByTestId('sessions-leave')).toBeNull();
    expect((screen.getByTestId('session-name') as HTMLInputElement).value).toBe('Late party');
    fireEvent.keyDown(screen.getByTestId('session-name'), { key: 'Escape' });
    fireEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
  });
  it('an untouched list closes at once', async () => {
    render(<Harness initial={[newSession('party', '22:00', 'a')]} />);
    open();
    fireEvent.keyDown(await screen.findByTestId('session-name'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
