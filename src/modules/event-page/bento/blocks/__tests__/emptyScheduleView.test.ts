import { describe, expect, it } from 'vitest';
import { emptyScheduleView } from '../schedule/emptyScheduleView';

// S2: a class or party without a programme must show its time, not "Schedule coming soon".
describe('emptyScheduleView', () => {
  it('shows the series time (or a date override) when there is no programme', () => {
    expect(emptyScheduleView({ isLoading: false, sessionCount: 0, fallbackTimeLabel: '8:00 pm - 11:30 pm' })).toEqual({
      kind: 'time',
      text: '8:00 pm - 11:30 pm',
    });
    expect(emptyScheduleView({ isLoading: false, sessionCount: 0, fallbackTimeLabel: '9:15 pm' })).toEqual({ kind: 'time', text: '9:15 pm' });
  });

  it('keeps "Schedule coming soon" when no time is known', () => {
    for (const fallbackTimeLabel of [null, undefined, '', '   ']) {
      expect(emptyScheduleView({ isLoading: false, sessionCount: 0, fallbackTimeLabel })).toEqual({ kind: 'text', text: 'Schedule coming soon' });
    }
  });

  it('does not advertise a time for a cancelled date', () => {
    expect(emptyScheduleView({ isLoading: false, sessionCount: 0, fallbackTimeLabel: '8:00 pm', cancelled: true })).toEqual({
      kind: 'text',
      text: 'Schedule coming soon',
    });
  });

  it('never replaces the day-filter message of a programme page, and loading stays loading', () => {
    expect(emptyScheduleView({ isLoading: false, sessionCount: 4, fallbackTimeLabel: '8:00 pm' })).toEqual({ kind: 'text', text: 'No sessions on this day' });
    expect(emptyScheduleView({ isLoading: true, sessionCount: 0, fallbackTimeLabel: '8:00 pm' })).toEqual({ kind: 'loading' });
  });
});
