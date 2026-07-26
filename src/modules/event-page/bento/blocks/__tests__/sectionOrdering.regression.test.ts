/**
 * Regression suite for the time-less-session change (2026-07-24 code review).
 *
 * Both cases below are USER-VISIBLE ordering/grouping regressions introduced by
 * surfacing time-less sessions. Each one is written to FAIL against the diff as
 * reviewed and PASS once fixed, so the fix is proved by execution rather than by
 * reading the code.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: () => ({ data: null, error: null }) },
}));

import { groupIntoSectionsFromServer } from '../ScheduleBlock';
import { orderSessionsForDisplay, type ProgramSection } from '../../../sections/EventScheduleGrid';

const mkSlot = (
  sectionId: string | null,
  startMins: number | null = 600,
  opts: { type?: string; sectionKind?: string; id?: string } = {},
) => ({
  startMins,
  endMins: startMins === null ? null : startMins + 60,
  sessions: [
    {
      id: opts.id ?? `sess-${sectionId ?? 'orphan'}-${startMins ?? 'tbc'}`,
      sectionId,
      sectionKind: opts.sectionKind ?? null,
      type: opts.type ?? 'class',
    } as unknown as never,
  ],
  isParallelClassy: false,
  hasParty: opts.type === 'party' || opts.type === 'performance' || opts.type === 'show',
}) as Parameters<typeof groupIntoSectionsFromServer>[0][number];

const mkPs = (o: Partial<ProgramSection> & { id: string; itemCount: number; kind?: string }): ProgramSection => ({
  id: o.id,
  kind: o.kind ?? 'classes',
  labelOverride: null,
  label: o.kind ?? 'classes',
  sortOrder: 0,
  dayId: 'd1',
  dayEventDate: '2026-05-09',
  daySortOrder: 0,
  itemCount: o.itemCount,
  ...o,
});

describe('section ordering is not hijacked by one time-less row', () => {
  it('ranks a section by its earliest TIMED slot, not by a time-less slot that sorts first', () => {
    // orderSessionsForDisplay maps a null start to -Infinity, so the untimed
    // CLASSES row leads the day and becomes slot index 0. Ranking a section by
    // its FIRST slot index therefore hoists the whole CLASSES section -- 20:00
    // sessions and all -- above an 18:00 MASTERCLASS.
    const slots = [
      mkSlot('classes-id', null),   // untimed class  -> slot 0
      mkSlot('master-id', 18 * 60), // 18:00 masterclass
      mkSlot('classes-id', 20 * 60), // 20:00 class
    ];
    const sections = groupIntoSectionsFromServer(slots, [
      mkPs({ id: 'classes-id', kind: 'classes', itemCount: 2 }),
      mkPs({ id: 'master-id', kind: 'masterclass', itemCount: 1 }),
    ]);
    // The 18:00 masterclass must still precede the 20:00 class block.
    expect(sections.map((s) => s.id)).toEqual(['master-id', 'classes-id']);
  });

  it('still gives a wholly time-less section its inherited program position', () => {
    // The legitimate goal of the change: a section with NO timed slot at all
    // keeps the position it arrived in, rather than sinking to the end.
    const slots = [
      mkSlot('master-id', null),     // wholly untimed masterclass, arrives first
      mkSlot('classes-id', 20 * 60),
    ];
    const sections = groupIntoSectionsFromServer(slots, [
      mkPs({ id: 'master-id', kind: 'masterclass', itemCount: 1 }),
      mkPs({ id: 'classes-id', kind: 'classes', itemCount: 1 }),
    ]);
    expect(sections.map((s) => s.id)).toEqual(['master-id', 'classes-id']);
  });
});

describe('legacy grouping does not split timed class runs', () => {
  it('keeps class/masterclass/class as ONE legacy section when all are timed', () => {
    // Pre-diff behaviour: kind was `hasParty ? 'party' : 'class'`, so a timed
    // masterclass merged into the surrounding class run. Splitting it into three
    // sections changes the layout of every legacy event with a timed masterclass.
    const slots = [
      mkSlot(null, 19 * 60, { type: 'class', id: 'a' }),
      mkSlot(null, 20 * 60, { type: 'masterclass', id: 'b' }),
      mkSlot(null, 21 * 60, { type: 'class', id: 'c' }),
    ];
    const sections = groupIntoSectionsFromServer(slots, []);
    expect(sections).toHaveLength(1);
    expect(sections[0].slots).toHaveLength(3);
  });

  it('still gives a TIME-LESS masterclass its own header', () => {
    // The change's actual goal, preserved.
    const slots = [
      mkSlot(null, null, { type: 'masterclass', id: 'm' }),
      mkSlot(null, 21 * 60, { type: 'class', id: 'c' }),
    ];
    const sections = groupIntoSectionsFromServer(slots, []);
    expect(sections).toHaveLength(2);
    expect(sections[0].kind).toBe('masterclass');
  });
});

describe('orderSessionsForDisplay is a strict total order', () => {
  it('is transitive and stable with several time-less rows', () => {
    const s = orderSessionsForDisplay([
      { startMins: 20 * 60, programIndex: 2 },
      { startMins: null, programIndex: 0 },
      { startMins: 18 * 60, programIndex: 3 },
      { startMins: null, programIndex: 1 },
    ]);
    expect(s.map((x) => x.programIndex)).toEqual([0, 1, 3, 2]);
  });
});
