// People arc S3: the DJ world (the record sleeve) as data. Pure, so the matrix test runs every
// prod shape through it without rendering. Every fact comes from facts/: this file only picks.
import { buildSignInHref } from '@/lib/authRouting';
import { resolvePublicName } from '@/lib/publicName';
import { listenLinks } from '@/components/dj/djRoleModel';
import type { DjGig } from '@/components/dj/DjTiles';
import { FIND_A_PARTY, cityLabel, countLabel, dayNumber, flagCode, gigDateLabel, monthLabel, showsJoinInvite, timeLabel, worldNames } from '../../facts';

export type DjWorldInput = {
  /** The get_public_dj_v1 row, read through djRoleFields for the text fields. */
  row: { id?: string | null; dj_name?: string | null; first_name?: string | null; surname?: string | null };
  cityName: string | null;
  nationalityCode: string | null;
  links: { soundcloud: string | null; mixcloud: string | null; instagram: string | null; website: string | null; facebook: string | null };
  upcoming: readonly DjGig[];
  past: readonly DjGig[];
  /** This page's path, where sign-up returns to. */
  pathname: string;
  /** The visitor (useAuth().user): D8'' shows the invite to signed-out visitors only. */
  viewer: { is_anonymous?: boolean | null } | null | undefined;
};

export type DjGigRow = { eventId: string; day: string | null; when: string | null; name: string; venue: string | null; next: boolean };
export type DjRecord = { eventId: string; month: string | null; name: string };

export type DjWorldView = {
  big: string;
  small: string | null;
  kicker: string | null;
  flag: string | null;
  count: string | null;
  upcoming: DjGigRow[];
  played: DjRecord[];
  /**
   * Nothing coming up (owner D11/D12): a muted line saying so ("No dates on the calendar yet." with no
   * dates at all, "No dates coming up yet." with only past ones), then one button to the parties list.
   */
  emptyAction: { note: string; label: string; href: string } | null;
  book: { label: string; value: string; href: string } | null;
  /** D8'': on every person page, whatever the person's roles, for a signed-out visitor; null when signed in. */
  invite: { label: string; href: string } | null;
};

const text = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A link as people read it: no scheme, "www.", query, hash or trailing slash ("instagram.com/dj_morcilla"). */
export const linkText = (href: string): string =>
  href.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

export function djWorldView(p: DjWorldInput): DjWorldView {
  // The public name is the person's own (first + surname): get_public_dj_v1's display_name is
  // COALESCE(dj_name, ...), so it is left out here and the DJ name goes in as djName.
  const name = resolvePublicName({ id: p.row.id, first_name: p.row.first_name, surname: p.row.surname });
  const { big, small } = worldNames({ name, djName: p.row.dj_name }, 'dj');
  const city = cityLabel(p.cityName);
  const upcoming = p.upcoming.map((g, i) => ({
    eventId: g.eventId,
    day: dayNumber(g.startTime),
    when: [gigDateLabel(g.startTime), timeLabel(g.startTime)].filter(Boolean).join(' \u00b7 ') || null,
    name: text(g.name) ?? 'Event',
    venue: text(g.location),
    next: i === 0,
  }));
  const played = p.past.map((g) => ({ eventId: g.eventId, month: monthLabel(g.startTime), name: text(g.name) ?? 'Event' }));
  const first = listenLinks(p.links)[0];
  return {
    big,
    small,
    kicker: city ? city.toUpperCase() : null,
    flag: flagCode(p.nationalityCode),
    count: countLabel(upcoming.length, 'gigs coming up'),
    upcoming,
    played,
    emptyAction: upcoming.length
      ? null
      : { note: played.length ? 'No dates coming up yet.' : 'No dates on the calendar yet.', ...FIND_A_PARTY },
    book: first ? { label: `Book ${big}`, value: linkText(first.href), href: first.href } : null,
    invite: showsJoinInvite(p.viewer) ? { label: 'Dance bachata too? Get your own card', href: buildSignInHref(p.pathname, 'signup') } : null,
  };
}
