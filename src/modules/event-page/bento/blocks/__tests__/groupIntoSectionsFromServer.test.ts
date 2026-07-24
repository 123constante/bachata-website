/**
 * Regression tests for the public schedule's section policy and session order.
 *
 * Part 1 -- empty-section policy in groupIntoSectionsFromServer. Locks in the
 * 2026-05-09 ruling, as superseded by the 2026-06-01 update:
 *
 *   1. Structurally-empty section (admin created the section header but
 *      never added items -- itemCount === 0) => DROP. The public page must
 *      never surface a "No sessions scheduled yet." placeholder; empty
 *      scaffolding is an editor-preview concern.
 *
 *   2. All-cancelled-for-this-occurrence (series itemCount > 0 but every
 *      session was filtered out by the occurrence cancellation filter --
 *      slots.length === 0) => DROP. Showing "No sessions scheduled yet."
 *      here is misleading; the schedule should be honest about what's on.
 *
 *   3. Section with surviving sessions => KEEP normally.
 *
 *   4. Orphan / legacy synthetic section (no programSections entry) => KEEP.
 *      Defensive: the section came from groupIntoSectionsLegacy fallback
 *      and would only ever carry slots, but we don't want a bug in the
 *      lookup to silently drop content.
 *
 * Part 2 -- time-less sessions ("Time TBC"). A session whose organiser never
 * set a start_time used to be dropped from the public page outright. It now
 * renders: it leads the day, keeps its section, and (when every session in the
 * slot is a masterclass) gets its own MASTERCLASS header. Content-free rows
 * are still suppressed so editor detritus never reaches the page.
 */
import { describe, expect, it, vi } from 'vitest';

// Vitest runs in node environment; the supabase client (transitively imported
// via ScheduleBlock -> EventScheduleGrid) reads localStorage at module load.
// Stub the integration module so the import chain stays pure for this unit test.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: () => ({ data: null, error: null }) },
}));

import { groupIntoSectionsFromServer, groupIntoSectionsFromItems } from '../ScheduleBlock';
import {
  isRenderableTimelessItem,
  orderSessionsForDisplay,
  fromFestivalSchedule,
  backfillFestivalPeople,
  type ProgramSection,
  type ScheduleSession,
  type Person,
} from '../../../sections/EventScheduleGrid';
import { asWallClock } from '@/lib/time/wallClock';
import type { FestivalScheduleItem } from '@/modules/event-page/types';

// Minimal slot fixture. groupIntoSectionsFromServer reads
// `slots[0].sessions[0].sectionId` for routing, the session type/sectionKind
// for the legacy kind derivation, and the slot's INDEX for section order.
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

const mkPs = (overrides: Partial<ProgramSection> & { id: string; itemCount: number; kind?: string }): ProgramSection => ({
  id: overrides.id,
  kind: overrides.kind ?? 'classes',
  labelOverride: null,
  label: overrides.kind ?? 'classes',
  sortOrder: 0,
  dayId: 'd1',
  dayEventDate: '2026-05-09',
  daySortOrder: 0,
  itemCount: overrides.itemCount,
  ...overrides,
});

describe('groupIntoSectionsFromServer -- empty-section policy', () => {

  it('drops a section whose series has items but none survived the occurrence filter (all cancelled)', () => {
    // CLASSES section in the series has 3 items. Public RPC filtered them all
    // out (cancelled-for-this-date overrides). PARTY section survives.
    const sections = groupIntoSectionsFromServer(
      [mkSlot('party-id', 1290)],
      [
        mkPs({ id: 'classes-id', kind: 'classes', itemCount: 3 }),
        mkPs({ id: 'party-id',   kind: 'party',   itemCount: 1 }),
      ],
    );
    expect(sections.map((s) => s.id)).toEqual(['party-id']);
  });

  it('drops a structurally-empty section (header added in editor, no items)', () => {
    // CLASSES section in the series has 0 items -- the organiser created the
    // header and never filled it. The public page must NOT surface it; only the
    // populated PARTY section survives.
    const sections = groupIntoSectionsFromServer(
      [mkSlot('party-id', 1290)],
      [
        mkPs({ id: 'classes-id', kind: 'classes', itemCount: 0 }),
        mkPs({ id: 'party-id',   kind: 'party',   itemCount: 1 }),
      ],
    );
    expect(sections.map((s) => s.id)).toEqual(['party-id']);
  });

  it('keeps a section with surviving sessions (normal case)', () => {
    const sections = groupIntoSectionsFromServer(
      [mkSlot('classes-id', 600), mkSlot('party-id', 1290)],
      [
        mkPs({ id: 'classes-id', kind: 'classes', itemCount: 3 }),
        mkPs({ id: 'party-id',   kind: 'party',   itemCount: 1 }),
      ],
    );
    expect(sections.map((s) => s.id)).toEqual(['classes-id', 'party-id']);
    expect(sections[0].slots.length).toBe(1);
    expect(sections[1].slots.length).toBe(1);
  });

  it('does not affect orphan / legacy sections (no programSections entry)', () => {
    // Slot has a sectionId that doesn't exist in programSections -- falls
    // through to the legacy synthetic bucket. That bucket carries slots,
    // so the suppression rule never fires for it.
    const sections = groupIntoSectionsFromServer(
      [mkSlot('phantom-id', 600)],
      [mkPs({ id: 'classes-id', kind: 'classes', itemCount: 3 })],
    );
    // Synthetic legacy section exists with the orphaned slot; the empty
    // CLASSES section is dropped (itemCount > 0, slots.length === 0).
    expect(sections.length).toBe(1);
    expect(sections[0].slots.length).toBe(1);
    expect(sections[0].id.startsWith('legacy-')).toBe(true);
  });

  it('keeps a section whose only slot is time-less (masterclass, no start)', () => {
    // The bug dropped a null-start masterclass upstream, leaving an empty
    // section that then got filtered as if it were structurally empty.
    const sections = groupIntoSectionsFromServer(
      [mkSlot('mc-id', null, { type: 'masterclass', sectionKind: 'masterclass' })],
      [mkPs({ id: 'mc-id', kind: 'masterclass', itemCount: 1 })],
    );
    expect(sections.map((s) => s.id)).toEqual(['mc-id']);
    expect(sections[0].slots.length).toBe(1);
  });

  it('orders sections by slot position, so a leading time-less section stays on top', () => {
    // Slots arrive in display order (orderSessionsForDisplay put the time-less
    // masterclass first). Section order must follow that, NOT sink the
    // time-less section to the end as the old `?? MAX_SAFE_INTEGER` sort did.
    // programSections order is deliberately reversed so a pass proves the sort.
    const sections = groupIntoSectionsFromServer(
      [
        mkSlot('mc-id', null, { type: 'masterclass', sectionKind: 'masterclass' }),
        mkSlot('party-id', 1380, { type: 'party' }),
      ],
      [
        mkPs({ id: 'party-id', kind: 'party', itemCount: 1 }),
        mkPs({ id: 'mc-id', kind: 'masterclass', itemCount: 1 }),
      ],
    );
    expect(sections.map((s) => s.id)).toEqual(['mc-id', 'party-id']);
  });
});

describe('groupIntoSectionsFromItems -- masterclass spine', () => {
  it('labels a null-sectionId all-masterclass slot as a "Masterclass" section', () => {
    // The occurrence-added masterclass carries section_id: null, so it routes
    // through the legacy/orphan path. Every session being a masterclass must
    // give it its own MASTERCLASS header (not "Class").
    const sections = groupIntoSectionsFromItems([
      mkSlot(null, null, { type: 'masterclass', sectionKind: 'masterclass' }),
    ]);
    expect(sections.length).toBe(1);
    expect(sections[0].label).toBe('Masterclass');
    expect(sections[0].slots.length).toBe(1);
  });
});

describe('orderSessionsForDisplay -- time-less placement + total order', () => {
  const s = (id: string, startMins: number | null, programIndex: number) => ({
    id, startMins, programIndex,
  });

  it('puts a time-less session above a later timed one (live Sensual Vibes shape)', () => {
    // Exactly what the RPC returns for occurrence 2714d3bd: the PARTY comes
    // back FIRST in the array (occurrence-added sessions are appended last),
    // so array order alone would sink the masterclass below the party.
    const ordered = orderSessionsForDisplay([
      s('party', 1380, 0),
      s('masterclass', null, 1),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['masterclass', 'party']);
  });

  it('keeps timed sessions chronological regardless of input order', () => {
    // The old mixed-key comparator was non-transitive: with one time-less row
    // present it could report a < b, b < c and c < a, letting V8 return the
    // input order untouched and pushing a 22:00 row above a 14:00 one.
    const inputs = [
      [s('a', 840, 0), s('b', 1050, 1), s('c', 1320, 2), s('z', null, 3)],
      [s('z', null, 3), s('c', 1320, 2), s('b', 1050, 1), s('a', 840, 0)],
      [s('c', 1320, 2), s('a', 840, 0), s('z', null, 3), s('b', 1050, 1)],
      [s('b', 1050, 1), s('z', null, 3), s('a', 840, 0), s('c', 1320, 2)],
    ];
    for (const input of inputs) {
      expect(orderSessionsForDisplay(input).map((x) => x.id)).toEqual(['z', 'a', 'b', 'c']);
    }
  });

  it('is unchanged for an all-timed program (chronological, programIndex tiebreak)', () => {
    const ordered = orderSessionsForDisplay([
      s('social', 1320, 4),
      s('rueda', 1140, 0),
      s('bachata', 1260, 3),
      s('salsa', 1200, 2),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['rueda', 'salsa', 'bachata', 'social']);
  });

  it('orders several time-less sessions by their RPC array position', () => {
    const ordered = orderSessionsForDisplay([
      s('tbc-b', null, 5),
      s('timed', 600, 9),
      s('tbc-a', null, 2),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['tbc-a', 'tbc-b', 'timed']);
  });
});

describe('isRenderableTimelessItem -- suppress editor detritus', () => {
  type Item = Parameters<typeof isRenderableTimelessItem>[0];
  const mkItem = (over: Record<string, unknown>) => ({
    id: 'i', title: null, type: 'class', start_time: null, end_time: null,
    sort_order: 0, levels: [], room: null, people: [],
    section_id: null, section_kind: null, section_label: null,
    ...over,
  } as unknown as Item);

  it('rejects a content-free row (RPC coalesces a NULL title to "Untitled")', () => {
    // Live shape from occurrence da08f3c6: no teacher, no level, placeholder
    // title. Before the null-start filter was removed this never reached the
    // page; it must not start rendering as a bare "Time TBC / UNTITLED" row.
    expect(isRenderableTimelessItem(mkItem({ title: 'Untitled' }))).toBe(false);
    expect(isRenderableTimelessItem(mkItem({ title: '  ' }))).toBe(false);
    expect(isRenderableTimelessItem(mkItem({ title: null }))).toBe(false);
  });

  it('accepts a real time-less session (title, teacher, or level)', () => {
    expect(isRenderableTimelessItem(mkItem({ title: 'Ronald y Alba' }))).toBe(true);
    expect(
      isRenderableTimelessItem(mkItem({ people: [{ profile_id: 'p1' }] })),
    ).toBe(true);
    expect(isRenderableTimelessItem(mkItem({ levels: ['open_level'] }))).toBe(true);
  });
});


describe('fromFestivalSchedule -- time-less rows (deferred review follow-up)', () => {
  const mkFest = (over: Partial<FestivalScheduleItem>): FestivalScheduleItem => ({
    id: null,
    day: asWallClock('2026-07-01T00:00:00'),
    type: 'class',
    title: 'Masterclass',
    // '' is unparseable -> formatWallClockTime returns null -> startMins null.
    startTime: asWallClock(''),
    endTime: null,
    venueRoom: null,
    isMasterclass: false,
    levels: [],
    instructors: [],
    djs: [],
    style: null,
    ...over,
  });

  it('gives two undated same-type rows DISTINCT ids (no colliding React key)', () => {
    const out = fromFestivalSchedule([mkFest({ title: 'MC A' }), mkFest({ title: 'MC B' })]);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.startMins === null)).toBe(true);
    expect(new Set(out.map((s) => s.id)).size).toBe(2);
  });

  it('drops a content-free time-less row (no title, people or levels)', () => {
    expect(fromFestivalSchedule([mkFest({ title: '' })])).toHaveLength(0);
    expect(fromFestivalSchedule([mkFest({ title: '   ' })])).toHaveLength(0);
  });

  it('keeps a time-less row that carries content', () => {
    expect(fromFestivalSchedule([mkFest({ title: 'Ronald y Alba' })])).toHaveLength(1);
    expect(
      fromFestivalSchedule([mkFest({ title: '', levels: ['open_level'] as FestivalScheduleItem['levels'] })]),
    ).toHaveLength(1);
  });

  it('keeps a TIMED row even with a placeholder title (its time anchors it)', () => {
    const out = fromFestivalSchedule([
      mkFest({ title: '', startTime: asWallClock('2026-07-01T19:30:00') }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].startMins).toBe(19 * 60 + 30);
  });
});

describe('backfillFestivalPeople -- no null-key collision (deferred review follow-up)', () => {
  const person = (id: string): Person => ({
    id, name: id, href: null, avatarUrl: null, role: 'teacher', profileType: 'teacher', level: null,
  });
  const mkSess = (over: Partial<ScheduleSession>): ScheduleSession => ({
    id: 'x', title: '', type: 'class', day: null, startMins: null, endMins: null,
    programIndex: 0, levels: [], room: null, people: [],
    sectionId: null, sectionKind: null, sectionLabel: null, ...over,
  });

  it('does NOT back-fill a time-less item (key would be null|type, cross-matching)', () => {
    const fest = [
      mkSess({ startMins: null, people: [person('a')] }),
      mkSess({ startMins: null, people: [person('b')] }),
    ];
    const items = [mkSess({ startMins: null, people: [] })];
    expect(backfillFestivalPeople(items, fest)[0].people).toEqual([]);
  });

  it('still back-fills a TIMED item from a matching time+type festival row', () => {
    const fest = [mkSess({ startMins: 1140, people: [person('a')] })];
    const items = [mkSess({ startMins: 1140, people: [] })];
    expect(backfillFestivalPeople(items, fest)[0].people.map((p) => p.id)).toEqual(['a']);
  });

  it("never overwrites an item's own lineup", () => {
    const fest = [mkSess({ startMins: 1140, people: [person('fest')] })];
    const items = [mkSess({ startMins: 1140, people: [person('own')] })];
    expect(backfillFestivalPeople(items, fest)[0].people.map((p) => p.id)).toEqual(['own']);
  });
});
