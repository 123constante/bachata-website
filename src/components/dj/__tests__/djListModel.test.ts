import { describe, expect, it } from 'vitest';
import { djTile, sortDjsUpcomingFirst } from '../djListModel';
import { dancerTags, onlyDancers, dancerHref } from '@/components/dancers/dancerListModel';
import { parseBadges, type PersonBadge } from '@/modules/person-page/badges';

const raw = (id: string, roles: string[], extra: Record<string, unknown> = {}) => ({ id, roles, dj_name: null, next_gig_date: null, dj_has_upcoming: false, ...extra });
const badges = parseBadges([
  raw('a', ['dancer']), raw('b', ['dancer', 'dj', 'teacher'], { dj_name: 'DJ Kiko' }), raw('c', ['teacher']),
  raw('d', ['dj']), raw('e', []), raw('f', ['dancer', 'teacher']),
]);

describe('/dancers model', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  it('keeps only people with the Dancer role', () => {
    expect(onlyDancers(rows, badges).map((r) => r.id)).toEqual(['a', 'b', 'f']);
  });
  it.each([false, true])('labels exclude Dancer, teacher flag=%s; never a /teachers/ href while off', (open) => {
    const t = (id: string) => dancerTags(badges.get(id) as PersonBadge, open);
    expect(t('a')).toEqual([]);
    expect(t('b').map((x) => x.label)).toEqual(['Teacher', 'DJ']);
    expect(t('f').map((x) => x.label)).toEqual(['Teacher']);
    if (!open) expect(t('b').every((x) => !x.href?.includes('/teachers/'))).toBe(true);
    expect(dancerHref('b', open)).toBe('/dancers/b');
  });
});

describe('/djs model', () => {
  const list = [
    { id: '1', dj_name: 'One', display_name: 'x' },
    { id: '2', dj_name: 'Two', display_name: 'x', has_upcoming_gig: true, next_gig_date: '2026-12-01' },
    { id: '3', dj_name: null, display_name: 'Three' },
    { id: '4', dj_name: 'Four', display_name: 'x', has_upcoming_gig: true, next_gig_date: '2026-11-01' },
  ];
  it('upcoming first by date, then the rest in original order', () => {
    expect(sortDjsUpcomingFirst(list).map((r) => r.id)).toEqual(['4', '2', '1', '3']);
  });
  it.each([false, true])('stage name leads and DJ label always shows, flag=%s', (open) => {
    const b = badges.get('b');
    const t = djTile({ id: 'b', dj_name: 'DJ Kiko', display_name: 'Real Name', has_upcoming_gig: true }, 'Real Name', b, open);
    expect(t.name).toBe('DJ Kiko');
    expect(t.tags.map((x) => x.label)).toContain('DJ');
    expect(t.playingSoon).toBe(true);
    expect(t.href).toBe('/djs/b');
    if (!open) expect(t.tags.every((x) => !x.href?.includes('/teachers/'))).toBe(true);
  });
  it('missing badge row still shows DJ', () => {
    const t = djTile(list[0], 'One', undefined, false);
    expect(t.tags.map((x) => x.label)).toEqual(['DJ']);
    expect(t.playingSoon).toBe(false);
  });
});
