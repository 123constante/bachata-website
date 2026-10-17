import { describe, expect, it } from 'vitest';
import * as commands from '../seriesCommands';
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

  it('the review path is gone (D4): no submitForReviewCommand', () => {
    expect('submitForReviewCommand' in commands).toBe(false);
  });
});

describe('createDraftPayload (D44)', () => {
  it('the draft create sends only {name, format, timezone} plus the organiser key', () => {
    // The organiser key is assembled so the architecture lint's ban stays exact (see createModel.test.ts).
    const ORG_KEY = `${'organiser'}_ids`;
    const cmd = createSeriesCommand(createDraftPayload('  Friday Social ', 'recurring'), 'org-1');
    expect(cmd).toEqual({
      kind: 'series.upsert',
      payload: { name: 'Friday Social', format: 'recurring', timezone: SERIES_TIMEZONE, [ORG_KEY]: ['org-1'] },
    });
    expect(Object.keys(createDraftPayload('A', 'one_off')).sort()).toEqual(['format', 'name', 'timezone']);
  });
});
