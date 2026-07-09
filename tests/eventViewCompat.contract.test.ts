/**
 * Contract test: event_view_p5(legacy_compat) — Phase 5.6 cutover gate
 *
 * Pins the legacy-compat shape against the deployed legacy RPCs
 * (get_event_program_v1 / get_occurrence_program_v1) on a live sample. The
 * Repo 2 hooks useProgramItems + useOccurrenceProgram now call event_view_p5
 * in legacy_compat mode; this test fails the moment the two diverge so we
 * catch drift before users see an empty schedule or missing teachers/DJs.
 *
 * Once Phase 5.10 drops the legacy RPCs, this test retires alongside them.
 */
import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BOGUS_UUID = '00000000-0000-0000-0000-000000000000';

async function pickFixture(): Promise<{ eventId: string; occurrenceId: string } | null> {
  // get_calendar_events is anon-callable and surfaces both event_id and
  // occurrence_id in one row. Walks +-30 days around now to find a published
  // event with a real occurrence; returns the first hit.
  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 30);
  const end = new Date(now); end.setDate(now.getDate() + 60);
  const { data, error } = await anon.rpc('get_calendar_events', {
    range_start: start.toISOString(),
    range_end: end.toISOString(),
    city_slug_param: null,
    p_include_past: true,
  } as never);
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = (data as Array<{ event_id?: string; occurrence_id?: string }>)
    .find((r) => Boolean(r.event_id && r.occurrence_id));
  return row?.event_id && row.occurrence_id
    ? { eventId: row.event_id, occurrenceId: row.occurrence_id }
    : null;
}

describe('event_view_p5(legacy_compat) — contract', () => {
  it('series path is byte-equal to get_event_program_v1', async () => {
    const fixture = await pickFixture();
    expect(fixture, 'expected a published event with occurrences').toBeTruthy();

    const [{ data: legacy }, { data: compat }] = await Promise.all([
      anon.rpc('get_event_program_v1' as never, { p_event_id: fixture!.eventId } as never),
      anon.rpc('event_view_p5' as never, {
        p_target: { series_id: fixture!.eventId },
        p_viewer: { role: 'anon', shape: 'legacy_compat' },
      } as never),
    ]);

    expect(compat).toEqual(legacy);
  });

  it('occurrence path is byte-equal to get_occurrence_program_v1', async () => {
    const fixture = await pickFixture();
    if (!fixture) return;

    const [{ data: legacy }, { data: compat }] = await Promise.all([
      anon.rpc('get_occurrence_program_v1' as never, {
        p_occurrence_id: fixture.occurrenceId,
      } as never),
      anon.rpc('event_view_p5' as never, {
        p_target: { occurrence_id: fixture.occurrenceId },
        p_viewer: { role: 'anon', shape: 'legacy_compat' },
      } as never),
    ]);

    expect(compat).toEqual(legacy);
  });

  it('is anon-callable and returns an array', async () => {
    const fixture = await pickFixture();
    if (!fixture) return;

    const { data, error } = await anon.rpc('event_view_p5' as never, {
      p_target: { occurrence_id: fixture.occurrenceId },
      p_viewer: { role: 'anon', shape: 'legacy_compat' },
    } as never);

    expect(error, 'event_view_p5 must be anon-callable').toBeNull();
    expect(Array.isArray(data), 'legacy_compat must return a JSON array').toBe(true);
  });

  it('raises invalid_target when neither series_id nor occurrence_id is supplied', async () => {
    const { error } = await anon.rpc('event_view_p5' as never, {
      p_target: {},
      p_viewer: { role: 'anon', shape: 'legacy_compat' },
    } as never);

    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/invalid_target/);
  });

  it('returns [] for a bogus occurrence id (graceful, matches legacy)', async () => {
    const { data, error } = await anon.rpc('event_view_p5' as never, {
      p_target: { occurrence_id: BOGUS_UUID },
      p_viewer: { role: 'anon', shape: 'legacy_compat' },
    } as never);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as unknown[]).length).toBe(0);
  });
});

describe('event_view_p5(snapshot_compat) — contract', () => {
  // As of admin migration 20260709070000 (m2a_snapshot_compat_native_only_v1),
  // snapshot_compat is served NATIVELY by _event_view_snapshot_compat_v1 — it no
  // longer delegates to (and is deliberately NOT byte-equal to) the legacy
  // get_event_page_snapshot_v2, which is now orphaned and no longer anon-callable
  // (admin migration 20260709080000 revoked anon/authenticated EXECUTE). So this
  // pins the snapshot_compat SHAPE the Website consumes (parseEventPageSnapshot),
  // not equality with the retired delegate.

  const assertSnapshotShape = (snap: unknown) => {
    expect(snap, 'snapshot_compat returned null for a published event').toBeTruthy();
    const s = snap as Record<string, unknown>;
    expect(typeof s.event_id).toBe('string');
    expect(s.event, 'event object').toBeTruthy();
    expect(typeof (s.event as Record<string, unknown>).name).toBe('string');
    expect(Array.isArray(s.occurrences), 'occurrences is an array').toBe(true);
    expect(Array.isArray(s.organisers), 'organisers is an array').toBe(true);
    expect(s.location_default, 'location_default object').toBeTruthy();
    expect(s.attendance, 'attendance object').toBeTruthy();
  };

  it('series path returns the native snapshot shape', async () => {
    const fixture = await pickFixture();
    expect(fixture, 'expected a published event with occurrences').toBeTruthy();

    const { data: compat, error } = await anon.rpc('event_view_p5' as never, {
      p_target: { series_id: fixture!.eventId },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    } as never);

    expect(error).toBeNull();
    assertSnapshotShape(compat);
  });

  it('occurrence path returns the native snapshot shape with the effective occurrence', async () => {
    const fixture = await pickFixture();
    if (!fixture) return;

    const { data: compat, error } = await anon.rpc('event_view_p5' as never, {
      p_target: {
        series_id: fixture.eventId,
        occurrence_id: fixture.occurrenceId,
      },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    } as never);

    expect(error).toBeNull();
    assertSnapshotShape(compat);
    // occurrence_effective should be populated when a specific occurrence is asked for.
    expect((compat as Record<string, unknown>).occurrence_effective).toBeTruthy();
  });

  it('orphaned get_event_page_snapshot_v2 is no longer anon-callable', async () => {
    const fixture = await pickFixture();
    if (!fixture) return;

    // Guards migration 20260709080000: the dead 52-row-loop delegate must not be
    // reachable by anon (it was an anon-facing path into the 3s statement_timeout).
    const { error } = await anon.rpc('get_event_page_snapshot_v2' as never, {
      p_event_id: fixture.eventId,
    } as never);

    expect(error, 'anon must NOT be able to call get_event_page_snapshot_v2').not.toBeNull();
  });

  it('is anon-callable', async () => {
    const fixture = await pickFixture();
    if (!fixture) return;

    const { error } = await anon.rpc('event_view_p5' as never, {
      p_target: { series_id: fixture.eventId },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    } as never);

    expect(error, 'event_view_p5(snapshot_compat) must be anon-callable').toBeNull();
  });

  it('raises invalid_target when series_id is missing', async () => {
    const { error } = await anon.rpc('event_view_p5' as never, {
      p_target: {},
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    } as never);

    expect(error).not.toBeNull();
    expect(error?.message ?? '').toMatch(/invalid_target/);
  });
});
