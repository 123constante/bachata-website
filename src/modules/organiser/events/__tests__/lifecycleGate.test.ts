/**
 * The rollback switch: goLiveReason with the A1 gate OFF still says the platform
 * update is pending; with it ON it never does. (The real constant is true on prod.)
 */
import { describe, expect, it } from 'vitest';
import { A1_REASON, goLiveReason } from '../lifecycleModel';
import type { EventWorkspace } from '../eventModel';

const ws = { series: { lifecycle_status: 'draft', name: 'Thursday Party', default_venue_id: null, default_cover_image_url: null, default_start_date: null }, dates: [] } as unknown as EventWorkspace;

describe('goLiveReason gate', () => {
  it('OFF: names the platform update and "Before then"', () => {
    const r = goLiveReason(ws, '2026-10-20', false) ?? '';
    expect(r).toContain(A1_REASON);
    expect(r).toContain('Before then');
  });
  it('ON: names only what is missing', () => {
    const r = goLiveReason(ws, '2026-10-20', true) ?? '';
    expect(r).toMatch(/^To go live, /);
    expect(r).not.toContain(A1_REASON);
  });
});
