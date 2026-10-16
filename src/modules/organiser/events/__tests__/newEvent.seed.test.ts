/**
 * firstListedDate: the earliest upcoming date that is not cancelled (the editor's `next`).
 * Mutation proof: firstListedDate picking a past or cancelled date reds 'firstListedDate'.
 * W1: the create seeds no session any more (the organiser adds sessions on the draft), so the
 * seedSessions cases that lived here went with it.
 */
import { describe, expect, it } from 'vitest';
import { firstListedDate, type WorkspaceDate } from '@/modules/organiser/shared/seriesModel';

// firstListedDate is seriesModel's (FIX-3 fix 6, review F9): the editor's `next` reads it;
// pages.test.tsx proves the create never calls it.

const date = (id: string, occurrence_date: string, lifecycle_status = 'scheduled'): WorkspaceDate => ({
  id, occurrence_date, lifecycle_status, version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
});

describe('firstListedDate: the earliest upcoming date that is not cancelled', () => {
  const today = '2026-10-08';
  it('skips past and cancelled dates, in any order the API returns them', () => {
    const dates = [date('o3', '2026-10-23'), date('o0', '2026-10-02'), date('o2', '2026-10-16'), date('oc', '2026-10-09', 'cancelled')];
    expect(firstListedDate(dates, today)?.id).toBe('o2');
  });
  it('today counts as upcoming (the writer refuses only a past date)', () => {
    expect(firstListedDate([date('t', today), date('n', '2026-10-15')], today)?.id).toBe('t');
  });
  it.each([
    ['no dates', []],
    ['only past dates', [date('p', '2026-10-01')]],
    ['only cancelled dates', [date('c', '2026-10-15', 'cancelled')]],
  ])('%s -> null, so the editor has no next date to put a session on', (_label, dates) => {
    expect(firstListedDate(dates, today)).toBeNull();
  });
});
