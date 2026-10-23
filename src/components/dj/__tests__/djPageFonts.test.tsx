// @vitest-environment jsdom
// People arc S3b (e): DM Serif Display loads wherever the DJ serif is on screen (the DJ world, a DJ
// preview inside another world), once, and stays while any user is mounted.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useDjPageFonts } from '../djPageTheme';
import { DjWorld, djWorldView } from '@/modules/person-page/worlds/dj';

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
      upcoming: [], past: [], pathname: '/djs/papacito',
    });
    const r = render(<MemoryRouter><DjWorld view={view} photo={null} bio={null} dates="ready" onRetry={() => undefined} /></MemoryRouter>);
    expect(links()).toHaveLength(1);
    r.unmount();
    expect(links()).toHaveLength(0);
  });
});
