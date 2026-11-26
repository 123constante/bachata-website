// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserClassInvites' ? flag.on : (t as Record<string | symbol, unknown>)[k]) }) };
});

import { parseProgramItems } from '../EventScheduleGrid';
import { mapPersonFromBadges } from '../../bento/blocks/ScheduleBlock';
import { PersonChip } from '../../bento/blocks/schedule/PersonChip';

const real = { profile_id: 'u-1', profile_type: 'teacher', display_name: 'Real One', avatar_url: null, sort_order: 0, level: null };
const item = (over: Record<string, unknown> = {}) => ({
  id: 'i1', title: 'Class', type: 'class', start_time: '2026-12-01T19:00:00', end_time: '2026-12-01T20:00:00',
  sort_order: 0, levels: null, room: null, people: [real], section_id: null, section_kind: null, section_label: null,
  pending_teachers: [{ display_name: ' Anna Lopez ' }, { display_name: '   ' }, { display_name: null }],
  ...over,
});
const parse = (i: unknown) => parseProgramItems([i]);

afterEach(() => { cleanup(); flag.on = true; });

describe('pending teachers on the public schedule', () => {
  it('flag on: appended after real people, trimmed, blank skipped', () => {
    const p = parse(item())[0].people;
    expect(p.map((x) => x.name)).toEqual(['Real One', 'Anna Lopez']);
    expect(p[1]).toMatchObject({ id: 'pending:i1:0', href: null, avatarUrl: null, profileType: 'teacher', pending: true, level: null });
  });
  it('flag off: nothing appended', () => {
    flag.on = false;
    expect(parse(item())[0].people.map((x) => x.name)).toEqual(['Real One']);
  });
  it('a same-name (case-insensitive) pending teacher is skipped', () => {
    const p = parse(item({ pending_teachers: [{ display_name: ' real one ' }] }))[0].people;
    expect(p).toHaveLength(1);
  });
  it('missing / null / empty pending_teachers = none', () => {
    for (const v of [undefined, null, []]) expect(parse(item({ pending_teachers: v }))[0].people).toHaveLength(1);
  });
  it('time-less pending-only item renders when flag on, not when off', () => {
    const only = item({ start_time: null, end_time: null, title: null, people: [], pending_teachers: [{ display_name: 'Anna Lopez' }] });
    expect(parse(only)).toHaveLength(1);
    flag.on = false;
    expect(parse(only)).toHaveLength(0);
  });
  it('badge mapping leaves a pending person unchanged and href null', () => {
    const pending = parse(item())[0].people[1];
    expect(mapPersonFromBadges(pending, undefined, false)).toBe(pending);
    expect(mapPersonFromBadges(pending, undefined, true).href).toBeNull();
  });
  it('chip shows initials and the name, no link, no image', () => {
    const pending = parse(item())[0].people[1];
    const { container } = render(<MemoryRouter><PersonChip person={pending} /></MemoryRouter>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('AL');
    expect(container.textContent).toContain('Anna Lopez');
  });
});
