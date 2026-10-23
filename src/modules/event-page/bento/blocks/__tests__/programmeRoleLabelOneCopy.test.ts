/**
 * W1 review M5: the programme chip's role text (parseProgramItems -> Person.role) is the ONE
 * vocabulary's (ROLE_LABEL in searchEntities, read through badges.ts roleTagsFor), not a local
 * copy. ROLE_LABEL is swapped for sentinels here: a second copy keeps printing "Teacher"/"DJ"
 * and goes RED. Non-person kinds keep their own words.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: null, error: null }), from: () => ({}) } }));
vi.mock('@/lib/searchEntities', async (orig) => {
  const real = await orig<typeof import('@/lib/searchEntities')>();
  return { ...real, ROLE_LABEL: { teacher: 'T-sentinel', dj: 'D-sentinel', dancer: 'X-sentinel' } };
});
// Review round 1 F7: a direct ROLE_LABEL lookup, not a fake badge pushed through roleTagsFor
// (the tag builder is for real badges). Routing through it again prints this and goes RED.
vi.mock('@/modules/person-page/badges', async (orig) => {
  const real = await orig<typeof import('@/modules/person-page/badges')>();
  return { ...real, roleTagsFor: () => [{ role: 'dj', label: 'via-roleTagsFor', href: null }] };
});

import { parseProgramItems } from '@/modules/event-page/sections/EventScheduleGrid';

const item = (type: string | null) => ({
  id: `i-${type}`, title: 'Slot', type: 'class', start_time: '2026-10-20T19:00:00', end_time: '2026-10-20T20:00:00',
  sort_order: 1, levels: [], room: null, section_id: null, section_kind: null, section_label: null,
  people: [{ profile_id: `p-${type}`, profile_type: type, display_name: 'Ana', avatar_url: null, sort_order: 1, level: null }],
});

describe('programme role text comes from ROLE_LABEL', () => {
  it.each([
    ['teacher', 'T-sentinel'],
    ['dj', 'D-sentinel'],
    ['dancer', 'X-sentinel'],
    ['videographer', 'Videographer'],
    ['vendor', 'Vendor'],
    [null, ''],
  ])('%s -> %s', (type, want) => {
    const [s] = parseProgramItems([item(type)]);
    expect(s.people[0].role).toBe(want);
  });
});
