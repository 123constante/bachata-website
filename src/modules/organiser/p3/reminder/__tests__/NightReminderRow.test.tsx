// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NightReminderRow } from '../NightReminderRow';
import type { ReminderRead } from '../reminderModel';

const read: ReminderRead = { enabled: true, sendAt: '2026-11-19T18:00:00Z', buyerCount: 4, sentAt: null, sentCount: 0, windowPassed: false, nightCancelled: false, nightLive: true, canEdit: true };
const api = vi.hoisted(() => ({ readReminder: vi.fn(), setReminder: vi.fn() }));
vi.mock('../reminderApi', () => api);

describe('NightReminderRow', () => {
  afterEach(cleanup);
  beforeEach(() => { api.readReminder.mockReset(); api.setReminder.mockReset(); });

  it('sends no command until the switch is used, then saves', async () => {
    api.readReminder.mockResolvedValue({ ok: true, read });
    api.setReminder.mockResolvedValue({ ok: true, read: { ...read, enabled: false } });
    render(<NightReminderRow occurrenceId="o1" />);
    const sw = await screen.findByTestId('p3-reminder-switch');
    expect(api.setReminder).not.toHaveBeenCalled();
    fireEvent.click(sw);
    await waitFor(() => expect(api.setReminder).toHaveBeenCalledWith('o1', false));
    await waitFor(() => expect(screen.getByTestId('p3-reminder-line').textContent).toMatch(/^Off/));
  });

  it('rolls back when the save fails', async () => {
    api.readReminder.mockResolvedValue({ ok: true, read });
    api.setReminder.mockRejectedValue(new Error('x'));
    render(<NightReminderRow occurrenceId="o1" />);
    fireEvent.click(await screen.findByTestId('p3-reminder-switch'));
    await screen.findByTestId('p3-reminder-error');
    expect(screen.getByTestId('p3-reminder-switch').getAttribute('aria-checked')).toBe('true');
  });

  it('a disabled switch says why and sends nothing', async () => {
    api.readReminder.mockResolvedValue({ ok: true, read: { ...read, windowPassed: true } });
    render(<NightReminderRow occurrenceId="o1" />);
    const sw = await screen.findByTestId('p3-reminder-switch');
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('p3-reminder-why').textContent).toMatch(/send time has passed/);
    fireEvent.click(sw);
    expect(api.setReminder).not.toHaveBeenCalled();
  });
});
