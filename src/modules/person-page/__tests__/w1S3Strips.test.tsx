// @vitest-environment jsdom
/**
 * W1 S3: organiser team list (link only: the Team list has no role labels since
 * organiser-page P1; its role-aware link came back in fix round 1), event lineup
 * person, search person row. Each surface x the S0
 * prod shapes x teacher flag off/on: tags and link must equal the badges mapping's answer,
 * no /teachers/ href while the flag is off, stage name only where shown as a DJ.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flag = vi.hoisted(() => ({ teacherDetail: false, searchV7: true, organiserSelfServe: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: flag }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: async () => ({ data: [], error: null }), from: () => ({}) } }));
vi.mock('@/lib/searchClickTelemetry', () => ({ recordSearchResultClick: () => {} }));
const emit = vi.hoisted(() => vi.fn());
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: emit }));

import { OrganiserTeamSection } from '@/modules/profile/OrganiserTeamSection';
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

describe.each(FLAGS)('teacher pages open = %s', (open) => {
  describe.each(SHAPES)('%s', (_n, roles, djName) => {
    const b = badge(roles, djName);
    const want = labels(b, open);
    const wantLink = linkFor(b, { teacherPagesOpen: open });

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

// Organiser page fix round 1 (lead decision): main's TeamCircle link behaviour and its
// tests, restored on the new Team list (OrganiserTeamSection). Role tags and the
// organiser-authored title stay gone (ACCEPTANCE: no role labels), so those blocks are
// not restored; the link, the loading/error fallback and the typed profile view are.
const person = { personId: ID, name: 'Real Name', avatarUrl: null, href: `/dancers/${ID}`, initials: 'RN' };
const drawTeam = (b: PersonBadge | undefined, state: 'loading' | 'error' | 'ready', p = person) => render(
  <MemoryRouter>
    <OrganiserTeamSection
      team={{ people: [p], mode: 'solo' }}
      failed={false}
      onRetry={() => {}}
      nationality={new Map([[ID, 'ES']])}
      badges={new Map(b ? [[ID, b]] : [])}
      badgesState={state}
    />
  </MemoryRouter>,
).container;

describe.each(FLAGS)('organiser team list, teacher pages open = %s', (open) => {
  it.each(SHAPES)('%s: link = the badges mapping, name is the real name, flag shows', (_n, roles, djName) => {
    flag.teacherDetail = open;
    const b = badge(roles, djName);
    const c = drawTeam(b, 'ready');
    expect(c.querySelector('a')?.getAttribute('href') ?? null).toBe(linkFor(b, { teacherPagesOpen: open }));
    expect(c.querySelector('[data-team-name]')?.textContent).toBe('Real Name');
    expect(c.querySelector('[data-nationality-flag]')?.getAttribute('data-nationality-flag')).toBe('ES');
    expect(c.querySelectorAll('[data-team-tag], [data-team-title]').length).toBe(0);
    if (!open) expect(c.innerHTML).not.toContain('/teachers/');
    flag.teacherDetail = false;
  });
});

describe('organiser team list while badges load / errored', () => {
  it.each(['loading', 'error'] as const)('%s: a person with a dancer page keeps /dancers/:id', (state) => {
    expect(drawTeam(undefined, state).querySelector('a')?.getAttribute('href')).toBe(`/dancers/${ID}`);
  });
  it.each(['loading', 'error'] as const)('%s: no dancer page, no link', (state) => {
    expect(drawTeam(undefined, state, { ...person, href: null }).querySelector('a')).toBeNull();
  });
  it('ready with no badge row: no link (the read answered)', () => {
    expect(drawTeam(undefined, 'ready').querySelector('a')).toBeNull();
  });
});

describe('organiser team list: profile view on click', () => {
  const click = (b: PersonBadge | undefined, state: 'loading' | 'error' | 'ready' = 'ready') => {
    emit.mockClear();
    fireEvent.click(drawTeam(b, state).querySelector('a')!);
    return emit.mock.calls.map((c) => [c[0].personId, c[0].profileType, c[0].context]);
  };
  it.each([
    ['DJ page', ['dj', 'dancer'] as PersonRole[], 'dj'],
    ['dancer page', ['teacher', 'dancer'] as PersonRole[], 'dancer'],
  ])('%s', (_n, roles, type) => {
    flag.teacherDetail = false;
    expect(click(badge(roles, null))).toEqual([[ID, type, 'organiser:team']]);
  });
  it('teacher page while open', () => {
    flag.teacherDetail = true;
    expect(click(badge(['teacher'], null))).toEqual([[ID, 'teacher', 'organiser:team']]);
    flag.teacherDetail = false;
  });
  it('the loading/error fallback link is a dancer view', () => {
    expect(click(undefined, 'error')).toEqual([[ID, 'dancer', 'organiser:team']]);
  });
});
