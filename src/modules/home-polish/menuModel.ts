// homePolish menu sheet: which LIST ROWS the full-screen menu shows, per role.
// Pure so the per-role matrix (signed out / signed in / organiser) is one table-driven test,
// and so the sheet and any later surface read ONE mapping (CLAUDE.md: never two copies).

export type MenuRole = 'signedOut' | 'signedIn' | 'organiser';

export interface MenuRow {
  id: string;
  label: string;
  /** Kept from the old nav (owner: keep bobbing emojis). */
  emoji: string;
  href: string;
  external?: boolean;
  /** Bob duration for .chrome-bob-sm. */
  bob: string;
}

export interface MenuInput {
  role: MenuRole;
  signInHref: string;
  venuesHref: string;
  communityHref: string;
  rafflesOn: boolean;
  accountHref: string;
  organiserHomeHref: string;
  sellTicketsHref: string;
}

export function menuRows(i: MenuInput): { account: MenuRow[]; browse: MenuRow[] } {
  const account: MenuRow[] = [];
  if (i.role === 'signedOut') {
    account.push({ id: 'signin', label: 'Sign in', emoji: '\u{1F511}', href: i.signInHref, bob: '1.5s' });
  } else {
    account.push({ id: 'profile', label: 'My profile', emoji: '\u{1F464}', href: i.accountHref, bob: '1.5s' });
  }
  if (i.role === 'organiser') {
    account.push({ id: 'orgdash', label: 'Organiser dashboard', emoji: '\u{1F4CB}', href: i.organiserHomeHref, bob: '1.7s' });
    account.push({ id: 'sell', label: 'Sell tickets', emoji: '\u{1F39F}\u{FE0F}', href: i.sellTicketsHref, bob: '1.9s' });
  }
  const browse: MenuRow[] = [
    { id: 'dancers', label: 'Dancers', emoji: '\u{1F483}', href: '/dancers', bob: '1.4s' },
    { id: 'teachers', label: 'Teachers', emoji: '\u{1F393}', href: '/teachers', bob: '1.6s' },
    { id: 'djs', label: 'DJs', emoji: '\u{1F3A7}', href: '/djs', bob: '1.8s' },
    { id: 'organisers', label: 'Organisers', emoji: '\u{1F3AA}', href: '/organisers', bob: '1.6s' },
    { id: 'venues', label: 'Venues', emoji: '\u{1F3DB}\u{FE0F}', href: i.venuesHref, bob: '1.8s' },
    ...(i.rafflesOn ? [{ id: 'raffles', label: 'Raffles', emoji: '\u{1F381}', href: '/raffles', bob: '1.7s' }] : []),
    { id: 'festivals', label: 'Festivals', emoji: '\u{1F3AA}', href: '/festivals', bob: '2.1s' },
    { id: 'cities', label: 'Cities and countries', emoji: '\u{1F30D}', href: '/cities', bob: '1.9s' },
    { id: 'community', label: 'Community', emoji: '\u{1F4AC}', href: i.communityHref, external: true, bob: '2.0s' },
  ];
  return { account, browse };
}

export const RATE_US_URL = 'https://g.page/r/Cc1SYPxlRrkmEBE/review';

export const SUPPORT_LINKS: { label: string; href: string }[] = [
  { label: '£3', href: 'https://buy.stripe.com/9B6fZgbh87ft8hicYc9R601' },
  { label: '£5', href: 'https://buy.stripe.com/28EeVc1Gy8jx1SU4rG9R600' },
  { label: '£10', href: 'https://buy.stripe.com/eVq7sKad4gQ3gNO4rG9R602' },
];
