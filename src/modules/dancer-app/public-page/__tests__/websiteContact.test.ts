import { describe, expect, it } from 'vitest';
import type { DancerPublicViewModel } from '@/modules/profile/dancerPublicProfile';
import { NO_EXTRAS, buildPublicDancerPage } from '../model';

/**
 * People S8: a stored "website" that is really an Instagram (or Facebook) profile.
 * One mapping feeds both the flag-OFF dancer page and the dancer world (DancerProfile.tsx
 * hands worldModel.contacts to WorldContact), so asserting the model covers both.
 */
type Links = DancerPublicViewModel['connectLinks'];
const contacts = (links: Partial<Links>) =>
  buildPublicDancerPage(
    { connectLinks: { instagram: null, facebook: null, website: null, email: null, ...links }, displayName: 'A', yearsDancing: null, favoriteStyles: [], partnerPracticeGoals: [], partnerSearchLevel: [], favoriteSongs: [], achievements: [] } as unknown as DancerPublicViewModel,
    NO_EXTRAS,
  ).contacts.map(({ kind, href, label }) => ({ kind, href, label }));

describe('website contact: label, kind and href by URL shape', () => {
  it.each([
    ['plain site', 'https://carladance.com', 'website', 'carladance.com'],
    ['www.', 'https://www.carladance.com', 'website', 'carladance.com'],
    ['trailing slash', 'https://carladance.com/about/', 'website', 'carladance.com/about'],
    ['?hl=en', 'https://carladance.com/?hl=en', 'website', 'carladance.com'],
    ['#x', 'https://carladance.com/classes#x', 'website', 'carladance.com/classes'],
    ['http', 'http://carladance.com', 'website', 'carladance.com'],
    ['uppercase host', 'https://WWW.CarlaDance.COM/Classes', 'website', 'carladance.com/Classes'],
    ['instagram profile', 'https://www.instagram.com/ben_bachatero/?hl=en', 'instagram', '@ben_bachatero'],
    ['instagram post', 'https://www.instagram.com/p/Cx1abc/?igsh=x', 'website', 'instagram.com/p/Cx1abc'],
    ['instagram reel', 'https://instagram.com/reel/Cx1abc/', 'website', 'instagram.com/reel/Cx1abc'],
    ['instagram explore', 'https://instagram.com/explore', 'website', 'instagram.com/explore'],
    ['instagram, no handle', 'https://instagram.com/', 'website', 'instagram.com'],
    ['m.instagram.com', 'https://m.instagram.com/alex.boneva', 'instagram', '@alex.boneva'],
    ['instagram, uppercase host', 'https://WWW.Instagram.COM/John_Otaran', 'instagram', '@John_Otaran'],
    ['not instagram, look-alike host', 'https://notinstagram.com/ben', 'website', 'notinstagram.com/ben'],
    ['facebook profile', 'https://www.facebook.com/carla.ruiz/?ref=x', 'facebook', 'facebook.com/carla.ruiz'],
    ['facebook profile.php (ambiguous)', 'https://www.facebook.com/profile.php?id=123', 'website', 'facebook.com/profile.php'],
    ['facebook group (ambiguous)', 'https://facebook.com/groups/bachata', 'website', 'facebook.com/groups/bachata'],
    ['garbage', 'https://not a url', 'website', 'not a url'],
  ] as const)('%s', (_n, website, kind, label) => {
    expect(contacts({ website })).toEqual([{ kind, href: website, label }]);
  });

  it('empty website: no row', () => {
    expect(contacts({ website: null })).toEqual([]);
  });

  it('instagram website + an instagram link with the SAME handle: one row (the instagram link)', () => {
    expect(contacts({ instagram: 'https://instagram.com/Ben_Bachatero', website: 'https://www.instagram.com/ben_bachatero/?hl=en' })).toEqual([
      { kind: 'instagram', href: 'https://instagram.com/Ben_Bachatero', label: '@Ben_Bachatero' },
    ]);
  });

  it('instagram website + an instagram link with a DIFFERENT handle: two instagram rows', () => {
    expect(contacts({ instagram: 'https://instagram.com/ben', website: 'https://instagram.com/ben_school' })).toEqual([
      { kind: 'instagram', href: 'https://instagram.com/ben', label: '@ben' },
      { kind: 'instagram', href: 'https://instagram.com/ben_school', label: '@ben_school' },
    ]);
  });

  it('facebook website + the same facebook link: one row', () => {
    expect(contacts({ facebook: 'https://facebook.com/carla.ruiz', website: 'https://www.facebook.com/Carla.Ruiz/' })).toEqual([
      { kind: 'facebook', href: 'https://facebook.com/carla.ruiz', label: 'facebook.com/carla.ruiz' },
    ]);
  });

  it('no label carries a query, a hash or a scheme', () => {
    const all = ['https://www.instagram.com/p/X/?igsh=1', 'https://a.com/b?c#d', 'http://www.facebook.com/profile.php?id=1#top'];
    for (const website of all) expect(contacts({ website })[0].label).not.toMatch(/[?#]|:\/\//);
  });
});
