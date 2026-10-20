// @vitest-environment jsdom
/**
 * S2b2: PublicDancerPageV2 `embedded` (the Dancing tab of /people/:id). One component, one
 * prop: the photo/name block goes (the person page shows the name once); everything else stays.
 * The standalone output (no prop) is pinned by a snapshot taken BEFORE the prop existed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { buildPublicDancerPage, NO_EXTRAS } from '../model';
import { PublicDancerPageV2 } from '../PublicDancerPageV2';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, authStatus: 'ready' }) }));

const row = {
  id: 'id-x', first_name: 'Ricky', surname: null, display_name: 'Ricky Q', nationality: 'EC', dance_role: 'Leader', instagram: '@ricky', facebook: null,
  avatar_url: 'https://cdn.example.test/p.jpg', website_url: null, gallery_urls: null, cities: { name: 'London' },
  dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual'], achievements: ['Won a thing'] },
};
const model = () =>
  buildPublicDancerPage(mapDancerPublicProfile(row as never), { bio: null, languages: ['en', 'es'], whatsapp: null }, []);
const show = (embedded?: boolean) =>
  render(
    <MemoryRouter>
      <PublicDancerPageV2 model={model()} profileId="id-x" pathname="/dancers/x" {...(embedded === undefined ? {} : { embedded })} />
    </MemoryRouter>,
  );
const q = (id: string) => screen.queryByTestId(id);

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: new Date('2026-10-18T12:00:00Z') });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('PublicDancerPageV2 embedded', () => {
  it('standalone (no prop) keeps the photo, the h1 name, the DANCER label and the back link', () => {
    show();
    expect(q('dancer-name')?.tagName).toBe('H1');
    expect(q('dancer-portrait')?.textContent).toContain('DANCER');
    expect(q('dancer-back')).not.toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('standalone markup is byte-for-byte what it was before the prop existed', () => {
    const { container } = show();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('embedded: no h1, no name, no portrait photo, no DANCER label, no back link', () => {
    const { container } = show(true);
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    expect(q('dancer-name')).toBeNull();
    expect(container.textContent).not.toContain('Ricky Q');
    expect(container.querySelector('img')).toBeNull();
    expect(q('dancer-portrait')?.textContent ?? '').not.toContain('DANCER');
    expect(q('dancer-back')).toBeNull();
  });

  it('embedded keeps the rest: role line, stats, languages, actions, share, achievements, join', () => {
    show(true);
    expect(q('dancer-role-line')).not.toBeNull();
    expect(q('dancer-facts')).not.toBeNull();
    expect(q('dancer-languages')).not.toBeNull();
    expect(q('dancer-connect')).not.toBeNull();
    expect(q('dancer-share')).not.toBeNull();
    expect(q('dancer-highlights')).not.toBeNull();
    expect(q('dancer-join')).not.toBeNull();
  });

  it.each([
    { name: 'standalone', embedded: undefined, line: 'Leader \u00b7 London' },
    { name: 'embedded (the person page already shows the city)', embedded: true, line: 'Leader' },
  ])('role line, $name', ({ embedded, line }) => {
    show(embedded);
    expect(q('dancer-role-line')?.textContent).toBe(line);
  });

  it('embedded with NO_EXTRAS and a thin record still renders without the header block', () => {
    render(
      <MemoryRouter>
        <PublicDancerPageV2 model={buildPublicDancerPage(mapDancerPublicProfile({ ...row, dancing_role_details: null, instagram: null } as never), NO_EXTRAS, [])} profileId="id-x" pathname="/dancers/x" embedded />
      </MemoryRouter>,
    );
    expect(q('dancer-name')).toBeNull();
    expect(q('dancer-page-v2')).not.toBeNull();
  });
});
