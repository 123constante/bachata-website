/**
 * Contract test: get_occurrence_program_v1 (Phase 2N)
 *
 * Locks the public schedule block's consumer-side contract for the new
 * occurrence-aware program reader. The RPC was shipped server-side in
 * Phase 2N (admin migration 20260509020000_calendar_occurrence_session
 * _overrides_read_paths_v1.sql) and Phase C wires the Website ScheduleBlock
 * to call it when ?occurrenceId=… is in the URL.
 *
 * Guards against:
 *   - The RPC being revoked from anon (publishable key is anon role).
 *   - The return shape drifting away from get_event_program_v1's shape —
 *     parseProgramItems in EventScheduleGrid.tsx assumes parity.
 *   - The override semantics regressing: the merged program for an
 *     occurrence must never have MORE rows than the series program.
 *     (Overrides only cancel / modify / hide; they never add sessions.)
 */
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type RpcPerson = {
  profile_id: string | null;
  profile_type: string | null;
  display_name: string | null;
  avatar_url: string | null;
  sort_order: number | null;
  level: string | null;
};

type RpcItem = {
  id: string;
  title: string | null;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number | null;
  levels: string[] | null;
  room: string | null;
  people: RpcPerson[] | null;
  section_id: string | null;
  section_kind: string | null;
  section_label: string | null;
};

const BOGUS_UUID = '00000000-0000-0000-0000-000000000000';

async function pickHealthyEventWithOccurrence(): Promise<{
  eventId: string;
  occurrenceId: string;
} | null> {
  // Reuse the lineup health-check RPC (already used by the lineup contract
  // test) to locate any published event with shaped data, then walk its
  // snapshot to grab a real occurrence_id.
  const { data: candidates, error } = await anon.rpc('lineup_health_check_v1');
  if (error || !Array.isArray(candidates)) return null;

  const okEvents = (candidates as Array<{ event_id: string; health: string }>)
    .filter((c) => c.health === 'ok');

  for (const ev of okEvents) {
    const { data: snap } = await anon.rpc('get_event_page_snapshot_v2', {
      p_event_id: ev.event_id,
    });
    const occurrences = (snap as { occurrences?: Array<{ occurrence_id: string }> } | null)
      ?.occurrences;
    if (occurrences && occurrences.length > 0) {
      return { eventId: ev.event_id, occurrenceId: occurrences[0].occurrence_id };
    }
  }
  return null;
}

describe('get_occurrence_program_v1 contract', () => {
  it('is callable by anon and returns an array', async () => {
    const fixture = await pickHealthyEventWithOccurrence();
    expect(fixture, 'expected at least one published event with occurrences').toBeTruthy();

    const { data, error } = await anon.rpc('get_occurrence_program_v1' as never, {
      p_occurrence_id: fixture!.occurrenceId,
    } as never);

    expect(error, 'get_occurrence_program_v1 must be anon-callable').toBeNull();
    expect(Array.isArray(data), 'must return a JSON array (possibly empty)').toBe(true);
  });

  it('returns the same shape as get_event_program_v1 (parseProgramItems parity)', async () => {
    const fixture = await pickHealthyEventWithOccurrence();
    if (!fixture) return; // covered by previous test's guard

    const { data } = await anon.rpc('get_occurrence_program_v1' as never, {
      p_occurrence_id: fixture.occurrenceId,
    } as never);

    const items = (data as RpcItem[] | null) ?? [];
    if (items.length === 0) return; // unpublished or empty program — nothing to lock

    // Every key parseProgramItems consumes must be present (value may be
    // null for nullable columns like room / section_label — the parser
    // handles both branches).
    const REQUIRED_KEYS = [
      'id',
      'title',
      'type',
      'start_time',
      'end_time',
      'levels',
      'room',
      'people',
      'section_id',
      'section_kind',
      'section_label',
    ] as const;
    for (const item of items) {
      for (const key of REQUIRED_KEYS) {
        expect(item, `key "${key}" must be present`).toHaveProperty(key);
      }
      expect(typeof item.id).toBe('string');
      expect(Array.isArray(item.people ?? []), 'people must be an array').toBe(true);
    }
  });

  it('overrides only subtract — occurrence count never exceeds series count', async () => {
    // Phase 2N's read-path contract: get_occurrence_program_v1 starts from
    // the series program and applies sparse overrides (cancel / modify /
    // hide-person). It MUST NOT add sessions that don't exist in the series.
    const fixture = await pickHealthyEventWithOccurrence();
    if (!fixture) return;

    const [{ data: occData }, { data: seriesData }] = await Promise.all([
      anon.rpc('get_occurrence_program_v1' as never, {
        p_occurrence_id: fixture.occurrenceId,
      } as never),
      anon.rpc('get_event_program_v1' as never, {
        p_event_id: fixture.eventId,
      } as never),
    ]);

    const occCount = ((occData as RpcItem[] | null) ?? []).length;
    const seriesCount = ((seriesData as RpcItem[] | null) ?? []).length;

    // For multi-day series the series count covers ALL days, not just the
    // occurrence's day, so this is a generous upper bound. It still catches
    // the regression we care about: overrides spawning extra rows.
    expect(occCount).toBeLessThanOrEqual(seriesCount);
  });

  it('returns [] for an unknown / bogus occurrence id (graceful)', async () => {
    const { data, error } = await anon.rpc('get_occurrence_program_v1' as never, {
      p_occurrence_id: BOGUS_UUID,
    } as never);

    // The RPC's documented behaviour is to return [] when the occurrence
    // (or its parent event) isn't published. ScheduleBlock surfaces this
    // as an empty schedule rather than a crash; the contract anchors that.
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as RpcItem[]).length).toBe(0);
  });
});

describe('get_occurrence_program_v1 occurrence-date re-anchoring (ODI arc 2026-06-05)', () => {
  it('re-anchors item dates to the occurrence local date (no template-month drift)', async () => {
    const fixture = await pickHealthyEventWithOccurrence();
    if (!fixture) return;

    const { data: snap } = await anon.rpc('get_event_page_snapshot_v2', {
      p_event_id: fixture.eventId,
    });
    const occ = (
      snap as { occurrences?: Array<{ occurrence_id: string; local_date?: string; starts_at?: string }> } | null
    )?.occurrences?.find((o) => o.occurrence_id === fixture.occurrenceId);
    const occDateStr = (occ?.local_date ?? occ?.starts_at ?? '').slice(0, 10);
    if (!occDateStr) return;
    const occDate = new Date(`${occDateStr}T00:00:00Z`).getTime();

    const { data } = await anon.rpc('get_occurrence_program_v1' as never, {
      p_occurrence_id: fixture.occurrenceId,
    } as never);
    const items = (data as RpcItem[] | null) ?? [];
    if (items.length === 0) return;

    for (const item of items) {
      if (!item.start_time) continue;
      const itemDate = new Date(`${item.start_time.slice(0, 10)}T00:00:00Z`).getTime();
      const dayDiff = Math.round((itemDate - occDate) / 86_400_000);
      // Items anchor to the occurrence day: allow -1 (post-midnight rollover)
      // through +14 (multi-day festival span). The fixed bug showed ~-28 days
      // (template month leaking through), which this catches.
      expect(
        dayDiff,
        `item ${item.id} start ${item.start_time} vs occurrence ${occDateStr}`,
      ).toBeGreaterThanOrEqual(-1);
      expect(dayDiff).toBeLessThanOrEqual(14);
    }
  });

  it('every item section_id resolves in the series sections RPC (option-c invariant)', async () => {
    const fixture = await pickHealthyEventWithOccurrence();
    if (!fixture) return;

    const [{ data: occData }, { data: secData }] = await Promise.all([
      anon.rpc('get_occurrence_program_v1' as never, { p_occurrence_id: fixture.occurrenceId } as never),
      anon.rpc('get_event_program_sections_v1' as never, { p_event_id: fixture.eventId } as never),
    ]);
    const items = (occData as RpcItem[] | null) ?? [];
    if (items.length === 0) return;
    const sectionIds = new Set(((secData as Array<{ id: string }> | null) ?? []).map((s) => s.id));
    if (sectionIds.size === 0) return; // legacy event without program-tree sections

    for (const item of items) {
      if (item.section_id == null) continue; // added / p5-native items may carry null
      expect(
        sectionIds.has(item.section_id),
        `section_id ${item.section_id} (item ${item.id}) must resolve to a series section`,
      ).toBe(true);
    }
  });
});
