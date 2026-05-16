/**
 * Contract test: public event page lineup
 *
 * Asserts that the canonical lineup pipeline (event_program_people →
 * event_view_p5(snapshot_compat) / get_public_festival_detail) returns
 * populated data for events admins have configured.
 *
 * Replaces a prior version that asserted lineup came from the legacy
 * dual-authority lineup table (frozen 2026-04-15, dropped 2026-04-30) — its
 * assertion was inverted (passing for the wrong reason). This version pins
 * the contract to the canonical EPP source and fails loudly if the wiring
 * breaks. Phase 5.6 cutover (2026-05-13) routes through event_view_p5 in
 * snapshot_compat mode; the underlying RPC is byte-equal by delegation.
 */

import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY!;

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe('public event page lineup contract', () => {
  it('lineup_health_summary_v1 reports at least one event with a populated lineup', async () => {
    // The bug we're guarding against was "every published event returned
    // an empty lineup." If with_lineup ever drops to zero while
    // published_events > 0, something has broken end to end.
    const { data, error } = await anon.rpc('lineup_health_summary_v1');
    expect(error, 'lineup_health_summary_v1 RPC must be callable by anon').toBeNull();
    expect(data).toBeTruthy();
    const summary = data as {
      published_events: number;
      with_lineup: number;
      missing_lineup: number;
      orphan_items: number;
      no_program: number;
      ok: number;
    };
    expect(summary.published_events).toBeGreaterThan(0);
    expect(summary.with_lineup,
      'at least one published event must have lineup data — the original bug was every event returning empty')
      .toBeGreaterThan(0);
  });

  it('get_event_page_snapshot_v2 returns a non-empty lineup for at least one published event', async () => {
    // Pick any published event that has EPP data via the health check, then
    // verify the public RPC returns its lineup. Avoids hardcoding a UUID
    // that could drift if events are deleted.
    const { data: candidates, error: healthError } = await anon.rpc('lineup_health_check_v1');
    expect(healthError).toBeNull();
    const okEvent = (candidates as Array<{ event_id: string; health: string }>)
      .find(c => c.health === 'ok');
    expect(okEvent, 'expected at least one event with health=ok').toBeTruthy();

    const { data, error } = await anon.rpc('event_view_p5' as never, {
      p_target: { series_id: okEvent!.event_id },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    } as never);
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const snap = data as {
      occurrence_effective: {
        lineup: {
          teachers: unknown[];
          djs: unknown[];
          dancers: unknown[];
          vendors: unknown[];
          videographers: unknown[];
        };
      };
    };
    const lineup = snap.occurrence_effective?.lineup;
    expect(lineup, 'effective occurrence must carry lineup').toBeTruthy();

    // At least teachers OR djs should be populated for an "ok" event.
    const totalPeople =
      lineup.teachers.length + lineup.djs.length + lineup.dancers.length +
      lineup.vendors.length + lineup.videographers.length;
    expect(totalPeople, 'lineup arrays must sum to non-zero for an ok event')
      .toBeGreaterThan(0);

    // Shape contract — every array key must exist (even if empty).
    expect(lineup).toMatchObject({
      teachers: expect.any(Array),
      djs: expect.any(Array),
      dancers: expect.any(Array),
      vendors: expect.any(Array),
      videographers: expect.any(Array),
    });
  });

  it('every occurrence in the snapshot carries a fully-shaped lineup object', async () => {
    // Regression guard: the original bug had per-occurrence lineup logic in
    // _v2 reading the wrong table. Ensure the lineup shape is consistent
    // across all occurrences (presence of all role arrays, even if empty).
    const { data: candidates } = await anon.rpc('lineup_health_check_v1');
    const okEvent = (candidates as Array<{ event_id: string; health: string }>)
      .find(c => c.health === 'ok');
    if (!okEvent) return; // tested in the previous case

    const { data } = await anon.rpc('event_view_p5' as never, {
      p_target: { series_id: okEvent.event_id },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    } as never);
    const occurrences = (data as any).occurrences as Array<{ lineup: any }>;
    expect(occurrences.length).toBeGreaterThan(0);
    for (const occ of occurrences) {
      expect(occ.lineup).toMatchObject({
        teachers: expect.any(Array),
        djs: expect.any(Array),
        dancers: expect.any(Array),
        vendors: expect.any(Array),
        videographers: expect.any(Array),
      });
    }
  });
});
