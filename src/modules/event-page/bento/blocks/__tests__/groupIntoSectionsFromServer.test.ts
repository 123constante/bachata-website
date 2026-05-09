/**
 * Regression test for the empty-section policy in groupIntoSectionsFromServer.
 *
 * Locks in the 2026-05-09 ruling for the public schedule:
 *
 *   1. Structural-empty section (admin created the section header before
 *      adding items — itemCount === 0) → KEEP. Renderer surfaces the header
 *      with "No sessions scheduled yet." (Phase 2B step 2e contract:
 *      "Don't hide it.")
 *
 *   2. All-cancelled-for-this-occurrence (series itemCount > 0 but every
 *      session was filtered out by get_occurrence_program_v1's cancellation
 *      filter — slots.length === 0) → DROP. Showing "No sessions scheduled
 *      yet." here is misleading; the schedule should be honest about what's
 *      actually on.
 *
 *   3. Section with surviving sessions → KEEP normally.
 *
 *   4. Orphan / legacy synthetic section (no programSections entry) → KEEP.
 *      Defensive: the section came from groupIntoSectionsLegacy fallback
 *      and would only ever carry slots, but we don't want a bug in the
 *      lookup to silently drop content.
 */
import { describe, expect, it, vi } from 'vitest';

// Vitest runs in node environment; the supabase client (transitively imported
// via ScheduleBlock → EventScheduleGrid) reads localStorage at module load.
// Stub the integration module so the import chain stays pure for this unit test.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: () => ({ data: null, error: null }) },
}));

import { groupIntoSectionsFromServer } from '../ScheduleBlock';
import type { ProgramSection } from '../../../sections/EventScheduleGrid';

// Minimal slot fixture — the function only reads `slots[0]?.sessions[0]?.sectionId`
// for routing and `slots[0]?.startMins` for sorting. Other fields are unused
// in this test path.
const mkSlot = (sectionId: string, startMins = 600) => ({
  startMins,
  endMins: startMins + 60,
  sessions: [{ sectionId } as unknown as never],
  isParallelClassy: false,
  hasParty: false,
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

describe('groupIntoSectionsFromServer — empty-section policy', () => {

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

  it('keeps a structurally-empty section (admin added header but no items yet)', () => {
    // CLASSES section in the series has 0 items — admin created the header
    // and hasn't filled it. Renderer should surface it with empty-state copy.
    const sections = groupIntoSectionsFromServer(
      [mkSlot('party-id', 1290)],
      [
        mkPs({ id: 'classes-id', kind: 'classes', itemCount: 0 }),
        mkPs({ id: 'party-id',   kind: 'party',   itemCount: 1 }),
      ],
    );
    expect(sections.map((s) => s.id).sort()).toEqual(['classes-id', 'party-id']);
    const classes = sections.find((s) => s.id === 'classes-id')!;
    expect(classes.slots.length).toBe(0);
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
    // Slot has a sectionId that doesn't exist in programSections — falls
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
});
