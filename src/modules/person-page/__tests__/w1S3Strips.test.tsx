// @vitest-environment jsdom
/**
 * W1 S3: organiser team strip, event lineup person, search person row. Each surface x the S0
 * prod shapes x teacher flag off/on: tags and link must equal the badges mapping's answer,
 * no /teachers/ href while the flag is off, stage name only where shown as a DJ.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flag = vi.hoisted(() => ({ teacherDetail: false, searchV7: true, organiserSelfServe: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: flag }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: [], error: null }), from: () => ({}) } }));
vi.mock('@/lib/searchClickTelemetry', () => ({ recordSearchResultClick: () => {} }));
const emit = vi.hoisted(() => vi.fn());
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: emit }));

import { TeamCircle } from '@/pages/OrganiserProfile';
import { fireEvent } from '@testing-library/react';
import { PersonRow } from '@/pages/SearchResults';
import { mapPersonFromBadges } from '@/modules/event-page/bento/blocks/ScheduleBlock';
import { linkFor, roleTagsFor, type PersonBadge } from '../badges';
import type { PersonRole } from '@/lib/searchEntities';

const ID = '11111111-1111-1111-1111-111111111111';
// The S0 prod survey shapes (counts in docs/handover/w1-s0-badges.md).
const SHAPES: Array<[string, PersonRole[], string | null]> = [
  ['teacher only', ['teacher'], null],
  ['dancer+teacher', ['teacher', 'dancer'], null],
  ['dancer+dj+teacher, stage name', ['teacher', 'dj', 'dancer'], 'Oreo Sensual'],
  ['dancer only', ['dancer'], null],
  ['dancer+dj, stage name', ['dj', 'dancer'], 'El Rugido'],
  ['dj only', ['dj'], null],
  ['dj+teacher', ['teacher', 'dj'], null],
  ['no public role', [], null],
];
const badge = (roles: PersonRole[], djName: string | null): PersonBadge => ({ id: ID, roles, djName, djHasUpcoming: false, nextGigDate: null });
const labels = (b: PersonBadge, open: boolean) => roleTagsFor(b, { teacherPagesOpen: open, withStageName: true }).map((t) => t.label);
const FLAGS = [false, true];
const member = { id: 'm1', memberId: ID, dancerId: ID, name: 'Real Name', avatarUrl: null, nationalityCode: null, role: 'Founder', isHead: null, isLeader: null };

describe.each(FLAGS)('teacher pages open = %s', (open) => {
  describe.each(SHAPES)('%s', (_n, roles, djName) => {
    const b = badge(roles, djName);
    const want = labels(b, open);
    const wantLink = linkFor(b, { teacherPagesOpen: open });

    it('organiser team strip', () => {
      flag.teacherDetail = open;
      const { container } = render(<MemoryRouter><TeamCircle member={member} badge={b} /></MemoryRouter>);
      expect(Array.from(container.querySelectorAll('[data-team-tag]')).map((e) => e.textContent)).toEqual(want);
      expect(container.querySelector('a')?.getAttribute('href') ?? null).toBe(wantLink);
      // Review M2: a team strip is not a DJ thing, so the real name leads; the stage name is
      // in the DJ tag only.
      expect(container.querySelector('[data-team-name]')?.textContent).toBe('Real Name');
      // Review 7d: the organiser-authored title shows next to the tags.
      expect(container.querySelector('[data-team-title]')?.textContent).toBe('Founder');
      if (!open) expect(container.innerHTML).not.toContain('/teachers/');
    });

    it('search person row', () => {
      flag.teacherDetail = open;
      const p = { id: ID, name: 'Real Name', image: null, roles, primaryRole: undefined, nationalityCode: null };
      const { container } = render(<MemoryRouter><PersonRow p={p} query="" badge={b} /></MemoryRouter>);
      expect(Array.from(container.querySelectorAll('[data-person-tag]')).map((e) => e.textContent)).toEqual(want);
      expect(container.querySelector('a')?.getAttribute('href') ?? null).toBe(wantLink);
      expect(container.innerHTML).not.toContain('/people/');
      expect(container.textContent).toContain('R'); // initials circle, never an empty box
      if (!open) expect(container.innerHTML).not.toContain('/teachers/');
    });

    it('event lineup person', () => {
      flag.teacherDetail = open;
      for (const profileType of ['dj', 'teacher', 'dancer']) {
        if (!roles.includes(profileType as PersonRole)) continue;
        const person = { id: ID, name: 'Real Name', href: `/${profileType}s/${ID}`, avatarUrl: null, role: profileType, profileType, level: null };
        const out = mapPersonFromBadges(person, b, false);
        expect(out.href).toBe(wantLink);
        expect(out.name).toBe(profileType === 'dj' && djName ? djName : 'Real Name');
        if (!open) expect(out.href ?? '').not.toContain('/teachers/');
      }
    });
  });
});

describe('organiser team strip: the organiser-authored title (review 7d)', () => {
  const b = badge(['dj', 'dancer'], 'El Rugido');
  const titleOf = (role: string | null) => {
    const { container } = render(<MemoryRouter><TeamCircle member={{ ...member, role }} badge={b} /></MemoryRouter>);
    return container.querySelector('[data-team-title]')?.textContent ?? null;
  };
  it.each([
    ['set', 'Founder', 'Founder'],
    ['set, padded', '  Head of music ', 'Head of music'],
    ['null: no "Team" default', null, null],
    ['blank', '   ', null],
    ['same word as a tag: not repeated', 'dj', null],
    // Prod 2026-10-21: all 58 active team rows carry role='Leader' (a system value, not an
    // authored title), so it is never shown.
    ['system value Leader: hidden', 'Leader', null],
    ['system value leader, padded/lowercase: hidden', '  leader ', null],
  ])('%s', (_n, role, want) => {
    expect(titleOf(role)).toBe(want);
  });
  it('the stage name stays in the DJ tag, never the name line', () => {
    const { container } = render(<MemoryRouter><TeamCircle member={member} badge={b} /></MemoryRouter>);
    expect(container.querySelector('[data-team-name]')?.textContent).toBe('Real Name');
    expect(container.querySelector('[data-team-tag="dj"]')?.textContent).toContain('El Rugido');
    expect(container.textContent).not.toContain('Team member');
  });
});

// Round 2 R2+R4: while the badges read loads, or when it failed, a member with a dancerId keeps
// the dancer page link (the strip's link before W1), like ScheduleBlock's feedFallback. The
// title waits for the read (loading: none, so it never flashes then hides on dedupe); on error
// it shows, since there are no tags to dedupe against.
describe('organiser team strip while badges load / errored', () => {
  const draw = (state: 'loading' | 'error' | 'ready', m = member) =>
    render(<MemoryRouter><TeamCircle member={m} badge={undefined} badgesState={state} /></MemoryRouter>).container;
  it.each(['loading', 'error'] as const)('%s: a member with a dancerId keeps /dancers/:id', (state) => {
    flag.teacherDetail = false;
    expect(draw(state).querySelector('a')?.getAttribute('href')).toBe(`/dancers/${ID}`);
  });
  it.each(['loading', 'error'] as const)('%s: no dancerId, no link', (state) => {
    expect(draw(state, { ...member, dancerId: null }).querySelector('a')).toBeNull();
  });
  it('ready with no badge row: no link (the read answered)', () => {
    expect(draw('ready').querySelector('a')).toBeNull();
  });
  it('loading: no title yet (no flash-then-hide)', () => {
    expect(draw('loading').querySelector('[data-team-title]')).toBeNull();
    expect(draw('loading', { ...member, role: 'dj' }).querySelector('[data-team-title]')).toBeNull();
  });
  it('error: the title shows (no tags to dedupe against)', () => {
    expect(draw('error').querySelector('[data-team-title]')?.textContent).toBe('Founder');
    expect(draw('error', { ...member, role: 'dj' }).querySelector('[data-team-title]')?.textContent).toBe('dj');
    expect(draw('error', { ...member, role: 'Leader' }).querySelector('[data-team-title]')).toBeNull();
  });
});

// Round 2 R6: the team link is a clickable profile, so it emits a profile view
// (.claude/rules/data-contracts.md), typed by the role the link opens.
describe('organiser team strip: profile view on click', () => {
  const click = (b: PersonBadge | undefined, state: 'loading' | 'error' | 'ready' = 'ready') => {
    emit.mockClear();
    const { container } = render(<MemoryRouter><TeamCircle member={member} badge={b} badgesState={state} /></MemoryRouter>);
    fireEvent.click(container.querySelector('a')!);
    return emit.mock.calls.map((c) => [c[0].personId, c[0].profileType]);
  };
  it.each([
    ['DJ page', ['dj', 'dancer'] as PersonRole[], 'dj'],
    ['dancer page', ['teacher', 'dancer'] as PersonRole[], 'dancer'],
  ])('%s', (_n, roles, type) => {
    flag.teacherDetail = false;
    expect(click(badge(roles, null))).toEqual([[ID, type]]);
  });
  it('teacher page while open', () => {
    flag.teacherDetail = true;
    expect(click(badge(['teacher'], null))).toEqual([[ID, 'teacher']]);
    flag.teacherDetail = false;
  });
  it('the loading/error fallback link is a dancer view', () => {
    expect(click(undefined, 'error')).toEqual([[ID, 'dancer']]);
  });
});

describe('event lineup person while badges load / are missing', () => {
  const t = { id: ID, name: 'T', href: `/teachers/${ID}`, avatarUrl: null, role: 'Teacher', profileType: 'teacher', level: null };
  const d = { ...t, href: `/djs/${ID}`, profileType: 'dj' };
  it('teacher has no link while loading, DJ keeps its valid one; missing after load = none', () => {
    flag.teacherDetail = false;
    expect(mapPersonFromBadges(t, undefined, true).href).toBeNull();
    expect(mapPersonFromBadges(d, undefined, true).href).toBe(`/djs/${ID}`);
    expect(mapPersonFromBadges(d, undefined, false).href).toBeNull();
  });
  it('vendors are untouched', () => {
    const v = { ...t, profileType: 'vendor', href: `/vendors/${ID}` };
    expect(mapPersonFromBadges(v, undefined, false)).toBe(v);
  });
});
