// @vitest-environment jsdom
// People arc S3b (e): DM Serif Display loads wherever the DJ serif is on screen (the DJ world, a DJ
// preview inside another world), once, and stays while any user is mounted.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useDjPageFonts } from '../djPageTheme';
import { DjWorld, djWorldView } from '@/modules/person-page/worlds/dj';
import { DancerWorld } from '@/modules/person-page/worlds/dancer/DancerWorld';
import type { Preview } from '@/modules/person-page/worlds/dancer/model';

afterEach(cleanup);
const links = () => document.head.querySelectorAll('link#dj-page-fonts');

const User = () => {
  useDjPageFonts();
  return null;
};

describe('useDjPageFonts', () => {
  it('one link for many users, kept until the last one unmounts', () => {
    const a = render(<User />);
    const b = render(<User />);
    expect(links()).toHaveLength(1);
    expect(links()[0].getAttribute('href')).toContain('DM+Serif+Display');
    a.unmount();
    expect(links()).toHaveLength(1);
    b.unmount();
    expect(links()).toHaveLength(0);
  });

  it('the DJ world loads it by itself (no page has to call the hook)', () => {
    const view = djWorldView({
      row: { id: 'dj1', dj_name: 'Morcilla' }, cityName: null, nationalityCode: null,
      links: { soundcloud: null, mixcloud: null, instagram: null, website: null, facebook: null },
      upcoming: [], past: [], pathname: '/djs/papacito', viewer: null,
    });
    const r = render(<MemoryRouter><DjWorld view={view} photo={null} bio={null} dates="ready" onRetry={() => undefined} /></MemoryRouter>);
    expect(links()).toHaveLength(1);
    r.unmount();
    expect(links()).toHaveLength(0);
  });

  // S2 critique: a dancer page whose lower half previews the DJ world draws "Next gig ..." in the DJ
  // serif, so it loads the font too (it fell back to Georgia); a teacher-only preview does not.
  const preview = (role: 'dj' | 'teacher'): Preview => ({ role, kicker: role.toUpperCase(), href: `/${role}s/x`, line: 'Next gig Friday 6 November', detail: null });
  const card = { name: 'Elias', photo: null, flag: null, sub: null, languages: null, contacts: [] };
  it.each([
    ['a DJ preview', [preview('dj')], 1],
    ['a DJ and a teacher preview', [preview('teacher'), preview('dj')], 1],
    ['a teacher preview only', [preview('teacher')], 0],
  ] as const)('a dancer page with %s loads the DJ serif only for a DJ preview', (_who, items, n) => {
    const lower = { roles: [], socials: { status: 'loading' as const }, half: { kind: 'previews' as const, heading: 'Coming up', items: [...items] } };
    const r = render(<MemoryRouter><DancerWorld card={card} lower={lower} inviteHref={null} /></MemoryRouter>);
    expect(links()).toHaveLength(n);
    r.unmount();
    expect(links()).toHaveLength(0);
  });
});
