import { describe, it, expect } from 'vitest';
import { diffAgainstAllowlist, scanTree } from '../scripts/check-rpc-typing.mjs';

// The gate freezes today's `rpc('<name>' as never|any)` laundering in
// scripts/rpc-typing-allowlist.json and fails on any drift. These cover the pure
// diff logic (deterministic, no fs) plus one real-tree control.

describe('diffAgainstAllowlist', () => {
  it('passes when the actual scan equals the allowlist', () => {
    const snap = { 'src/a.ts': { event_view_p5: 1 }, 'src/b.ts': { search_public_v2: 2 } };
    const { additions, increases, stale } = diffAgainstAllowlist(snap, snap);
    expect(additions).toHaveLength(0);
    expect(increases).toHaveLength(0);
    expect(stale).toHaveLength(0);
  });

  it('flags a NEW (file, rpc) laundering as an addition', () => {
    const allow = { 'src/a.ts': { event_view_p5: 1 } };
    const actual = { 'src/a.ts': { event_view_p5: 1 }, 'src/new.ts': { get_map_events_v1: 1 } };
    const { additions } = diffAgainstAllowlist(actual, allow);
    expect(additions).toEqual([{ file: 'src/new.ts', rpc: 'get_map_events_v1', actual: 1, allowed: 0 }]);
  });

  it('treats an un-allowlisted RPC (e.g. get_calendar_events_v2) as zero-tolerance', () => {
    const allow = { 'src/a.ts': { event_view_p5: 1 } };
    const actual = { 'src/a.ts': { event_view_p5: 1, get_calendar_events_v2: 1 } };
    const { additions } = diffAgainstAllowlist(actual, allow);
    expect(additions).toEqual([
      { file: 'src/a.ts', rpc: 'get_calendar_events_v2', actual: 1, allowed: 0 },
    ]);
  });

  it('flags an INCREASE in an allowlisted (file, rpc) count', () => {
    const allow = { 'src/a.ts': { event_view_p5: 1 } };
    const actual = { 'src/a.ts': { event_view_p5: 2 } };
    const { increases } = diffAgainstAllowlist(actual, allow);
    expect(increases).toEqual([{ file: 'src/a.ts', rpc: 'event_view_p5', actual: 2, allowed: 1 }]);
  });

  it('flags a STALE allowlist entry when a laundered call was removed', () => {
    const allow = { 'src/a.ts': { event_view_p5: 2 } };
    const actual = { 'src/a.ts': { event_view_p5: 1 } };
    const { stale } = diffAgainstAllowlist(actual, allow);
    expect(stale).toEqual([{ file: 'src/a.ts', rpc: 'event_view_p5', actual: 1, allowed: 2 }]);
  });

  it('flags a fully-removed file as stale', () => {
    const allow = { 'src/gone.ts': { record_event_view_v1: 1 } };
    const actual = {};
    const { stale } = diffAgainstAllowlist(actual, allow);
    expect(stale).toEqual([{ file: 'src/gone.ts', rpc: 'record_event_view_v1', actual: 0, allowed: 1 }]);
  });
});

describe('scanTree (real repo)', () => {
  // Wall time here tracks machine LOAD, not the detector: this case walks the
  // real tree (SCAN_PATHS = src, app, tests, middleware.ts) off disk while the
  // rest of the parallel pool runs. Measured: ~0.8s alone, ~2.6s in the full
  // 87-file pool, and 5056ms on the pre-push run that blocked d39d261 -- a red
  // that named rpc-typing for what was purely a scheduling problem. The 20000
  // below is ~4x that worst observed figure. Raise it HERE only, never
  // globally.
  //
  // Do NOT delete this case as "redundant with check:rpc-typing" -- that was
  // tried and reverted. The guard's own printed remediation
  // ("Shrink the allowlist ... --write") blesses whatever it currently finds,
  // so the guard cannot witness its OWN detector going blind; and
  // check-rpc-typing.mjs is recorded R4:no-canary in
  // script-conventions-allowlist.json, so it has no self-test either. That
  // makes this spec the detector's only coverage in any tier.
  it('detects laundered rpc() calls and never reports get_calendar_events_v2 (it is fully typed)', async () => {
    const map = await scanTree();
    const flat = Object.values(map).flatMap((rpcs) => Object.keys(rpcs));
    // The tree still has laundered calls (frozen in the allowlist)...
    expect(flat.length).toBeGreaterThan(0);
    // ...but get_calendar_events_v2 was routed through the typed boundary in #117.
    expect(flat).not.toContain('get_calendar_events_v2');
  }, 20000);
});
