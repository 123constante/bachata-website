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

import { TeamCircle } from '@/pages/OrganiserProfile';
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
      expect(container.querySelector('[data-team-name]')?.textContent).toBe(roles.includes('dj') && djName ? djName : 'Real Name');
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
