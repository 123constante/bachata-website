// @vitest-environment jsdom
// ER-FIX-C4: sheet findings C4-1, C4-2, C4-3, C4-5, C4-10, C4-11, C4-12.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { SessionSheet } from '../SessionSheet';
import { newSession, type SessionDraft, type SessionPerson } from '../sessionsModel';

afterEach(cleanup);

const search = async (): Promise<SessionPerson[]> => [];

function Harness({ initial, onSave }: { initial: SessionDraft[]; onSave?: (l: SessionDraft[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit sessions</button>
      {open && <SessionSheet open onOpenChange={setOpen} sessions={initial} onSave={onSave ?? (() => undefined)} search={search} recent={[]} onRecentChange={() => undefined} />}
    </>
  );
}

const open = () => fireEvent.click(screen.getByText('Edit sessions'));
const done = async () => (await screen.findByTestId('sessions-done')) as HTMLButtonElement;
const untimed = (id: string): SessionDraft => ({ ...newSession('party', '21:00', id), start: '', end: '' });

describe('SessionSheet fixes', () => {
  it('C4-1: a class with no level does not block Done; the organiser can add to the party', async () => {
    const onSave = vi.fn();
    render(<Harness initial={[newSession('class', '20:00', 'c'), newSession('party', '21:00', 'p')]} onSave={onSave} />);
    open();
    const d = await done();
    expect(d.disabled).toBe(false);
    fireEvent.click(screen.getAllByTestId('room-add')[0]);
    fireEvent.change(screen.getAllByTestId('session-room')[1], { target: { value: 'Main' } });
    fireEvent.click(d);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0][0].levels).toEqual([]);
  });

  it('C4-2: each card shows its own reason without tapping Done', async () => {
    render(<Harness initial={[newSession('party', '21:00', 'a'), { ...newSession('party', '23:00', 'b'), name: '' }]} />);
    open();
    await done();
    const shown = screen.getAllByTestId('session-issues');
    expect(shown).toHaveLength(1);
    expect(screen.getByTestId('session-b').contains(shown[0])).toBe(true);
  });

  it('C4-3: untimed session: Start shows "Pick a start", End is disabled, reason "Pick a start time"', async () => {
    render(<Harness initial={[untimed('a')]} />);
    open();
    const start = (await screen.findByTestId('session-start')) as HTMLSelectElement;
    expect(start.value).toBe('');
    expect(start.options[start.selectedIndex].textContent).toBe('Pick a start');
    expect((screen.getByTestId('session-end') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByTestId('session-issues').textContent).toBe('Pick a start time');
    // Like the writer, a stored untimed session blocks nothing until its times change: a rename saves.
    expect((await done()).disabled).toBe(false);
    fireEvent.change(screen.getByTestId('session-name'), { target: { value: 'Late party' } });
    expect((await done()).disabled).toBe(false);
    expect(screen.queryByTestId('sessions-reason')).toBeNull();
    fireEvent.change(start, { target: { value: '21:00' } });
    expect((screen.getByTestId('session-end') as HTMLSelectElement).disabled).toBe(false);
    expect((await done()).disabled).toBe(false);
  });

  it('C4-5: Done on an untouched list closes without saving; a change saves', async () => {
    const onSave = vi.fn();
    const late = newSession('party', '01:00', 'late');
    const eve = newSession('class', '21:00', 'eve');
    render(<Harness initial={[late, eve]} onSave={onSave} />);
    open();
    fireEvent.click(await done());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    open();
    fireEvent.change(screen.getAllByTestId('session-name')[0], { target: { value: 'Beginners' } });
    fireEvent.click(await done());
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('C4-11: Escape returns focus to the opener', async () => {
    render(<Harness initial={[newSession('party', '22:00', 'a')]} />);
    const opener = screen.getByText('Edit sessions');
    opener.focus();
    open();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('C4-12: the disabled Done names its reason to a screen reader', async () => {
    render(<Harness initial={[newSession('party', '21:00', 'a')]} />);
    open();
    fireEvent.change(await screen.findByTestId('session-name'), { target: { value: '' } });
    const d = await done();
    expect(d.disabled).toBe(true);
    const id = d.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent).toBe('Name needed');
  });

  it('C4-10: the session sources hold no raw non-ASCII', () => {
    for (const f of ['SessionCard.tsx', 'SessionSheet.tsx', 'sessionsModel.ts']) {
      const src = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect(src.match(/[^\x00-\x7f]/g) ?? [], f).toEqual([]);
    }
  });
});
