import { describe, expect, it } from 'vitest';
import { createDraftPayload, lifecycleCommand, moveDateCommand, uncancelCommand, unskipDateCommand, SERIES_TIMEZONE } from '../seriesCommands';
import { createSeriesCommand } from '../selfServeApi';

describe('R1 commands (4.3 #6)', () => {
  it('move day: occurrence.move_date {to_date} (D39)', () => {
    expect(moveDateCommand('2026-10-31')).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-10-31' } });
  });

  it('put a cancelled date back is occurrence.cancel {cancelled:false}; unskip is for taken-off dates (D46)', () => {
    expect(uncancelCommand()).toEqual({ kind: 'occurrence.cancel', payload: { cancelled: false } });
    expect(unskipDateCommand('2026-10-31')).toEqual({ kind: 'series.unskip_date', payload: { date: '2026-10-31' } });
  });

  it('pause/resume send set_lifecycle {to}', () => {
    expect(lifecycleCommand('paused')).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'paused' } });
    expect(lifecycleCommand('live')).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
  });
});

describe('createDraftPayload (D44)', () => {
  it('the draft create sends only {name, format, timezone, organiser_ids}', () => {
    const cmd = createSeriesCommand(createDraftPayload('  Friday Social ', 'recurring'), 'org-1');
    expect(cmd).toEqual({
      kind: 'series.upsert',
      payload: { name: 'Friday Social', format: 'recurring', timezone: SERIES_TIMEZONE, organiser_ids: ['org-1'] },
    });
    expect(Object.keys(createDraftPayload('A', 'one_off')).sort()).toEqual(['format', 'name', 'timezone']);
  });
});
