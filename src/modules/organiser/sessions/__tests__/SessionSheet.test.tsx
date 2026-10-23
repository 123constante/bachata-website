// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { SessionSheet } from '../SessionSheet';
import { newSession, type SessionDraft, type SessionPerson } from '../sessionsModel';

afterEach(cleanup);

const search = vi.fn(async (term: string): Promise<SessionPerson[]> => (term.toLowerCase().startsWith('mar') ? [{ id: 'p1', name: 'Marta' }] : []));

function Harness({ initial, onSave }: { initial: SessionDraft[]; onSave?: (l: SessionDraft[]) => void }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<SessionPerson[]>([{ id: 'r1', name: 'Sofia' }]);
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit sessions</button>
      {open && <SessionSheet open onOpenChange={setOpen} sessions={initial} onSave={onSave ?? (() => undefined)} search={search} recent={recent} onRecentChange={setRecent} />}
    </>
  );
}

const open = () => fireEvent.click(screen.getByText('Edit sessions'));

describe('SessionSheet', () => {
  it('moves focus into the sheet and Escape closes it, returning focus to the opener', async () => {
    render(<Harness initial={[newSession('party', '22:00', 'a')]} />);
    const opener = screen.getByText('Edit sessions');
    opener.focus();
    open();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a lesson shows quick lengths and a read-only end; a party shows an end list of later times only', async () => {
    render(<Harness initial={[newSession('class', '19:00', 'a')]} />);
    open();
    expect(await screen.findByTestId('length-60')).toBeTruthy();
    expect(screen.getByTestId('session-end-text').textContent).toBe('20:00');
    fireEvent.click(screen.getByTestId('length-90'));
    expect(screen.getByTestId('session-end-text').textContent).toBe('20:30');
    fireEvent.click(screen.getByTestId('kind-party'));
    const end = screen.getByTestId('session-end') as HTMLSelectElement;
    const values = Array.from(end.options).map((o) => o.value);
    expect(values).not.toContain('19:00');
    expect(screen.queryByTestId('length-60')).toBeNull();
    fireEvent.change(screen.getByTestId('session-start'), { target: { value: '23:00' } });
    const labels = Array.from((screen.getByTestId('session-end') as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels).toContain('01:00 (next day)');
  });

  it('a class level is optional; the levels picked are saved', async () => {
    const onSave = vi.fn();
    render(<Harness initial={[newSession('class', '19:00', 'a')]} onSave={onSave} />);
    open();
    const done = (await screen.findByTestId('sessions-done')) as HTMLButtonElement;
    expect(done.disabled).toBe(false);
    expect(screen.queryByTestId('sessions-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('level-beginner'));
    fireEvent.click(screen.getByTestId('level-improver'));
    expect(done.disabled).toBe(false);
    fireEvent.click(done);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0][0].levels).toEqual(['beginner', 'improver']);
  });

  it('the room box is hidden until Add a room, then shows on every session', async () => {
    render(<Harness initial={[newSession('party', '22:00', 'a'), newSession('party', '23:30', 'b')]} />);
    open();
    expect(await screen.findAllByTestId('room-add')).toHaveLength(2);
    expect(screen.queryByTestId('session-room')).toBeNull();
    fireEvent.click(screen.getAllByTestId('room-add')[0]);
    expect(screen.getAllByTestId('session-room')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('room-remove')[0]);
    expect(screen.queryByTestId('session-room')).toBeNull();
  });

  it('Add another session starts where the last ends and keeps time order', async () => {
    render(<Harness initial={[newSession('party', '22:00', 'a')]} />);
    open();
    fireEvent.click(await screen.findByTestId('sessions-add'));
    const starts = screen.getAllByTestId('session-start') as HTMLSelectElement[];
    expect(starts.map((s) => s.value)).toEqual(['22:00', '00:00']);
  });

  it('line-up: search finds a profile, Recent adds in one tap, none says what the person can do', async () => {
    render(<Harness initial={[newSession('party', '22:00', 'a')]} />);
    open();
    fireEvent.click(await screen.findByTestId('recent-r1'));
    expect(screen.getByTestId('person-r1')).toBeTruthy();
    fireEvent.change(screen.getByTestId('lineup-search'), { target: { value: 'Mar' } });
    fireEvent.click((await screen.findByTestId('hit-p1', {}, { timeout: 2000 })).querySelector('button') as Element);
    expect(screen.getByTestId('person-p1')).toBeTruthy();
    fireEvent.change(screen.getByTestId('lineup-search'), { target: { value: 'zzz' } });
    expect((await screen.findByTestId('lineup-none', {}, { timeout: 2000 })).textContent).toContain('Only people with a profile');
  });
});
