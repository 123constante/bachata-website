import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { type PublicPageExtras, NAMELESS_SHARE_TITLE, NO_EXTRAS, SHARE_MESSAGES, buildPublicDancerPage, joinHref, shareDancerPage, whatsappHref } from '../model';
import { EXTRAS, SHAPES } from './shapes';

const page = (key: keyof typeof SHAPES, extras = NO_EXTRAS) => {
  const rec = SHAPES[key];
  return buildPublicDancerPage(mapDancerPublicProfile(rec as never), extras, (rec.gallery_urls as string[] | null) ?? []);
};

// "11 years" is clock-derived: pin Date.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-17T12:00:00Z') });
});
afterAll(() => {
  vi.useRealTimers();
});

describe('public page v2 model, by shape', () => {
  it.each([
    ['photoless', 'Dani', null],
    ['long name', 'Maria-Fernanda Alejandra de los Santos', null],
    ['surname hidden', 'Fay', null],
    ['nameless', 'Dancer', null],
    ['admin-made unclaimed', 'Eli Gomez', null],
    ['complete + all extras', 'Carla Ruiz', 'Manchester \u00b7 Spain'],
  ] as const)('%s: heading %s, place %s', (key, name, place) => {
    const m = page(key);
    expect(m.name).toBe(name);
    if (place) expect(m.place).toBe(place);
  });

  it('surname hidden: the model has only the masked name (no surname anywhere)', () => {
    expect(JSON.stringify(page('surname hidden'))).not.toContain('Secret');
  });

  it('photoless: no avatar url (the page draws PersonAvatar\'s no-photo face)', () => {
    expect(page('photoless').avatarUrl).toBeNull();
  });

  it("every section of today's page has a home in v2 (complete + all extras)", () => {
    const m = page('complete + all extras');
    expect(m.role).toBe('Lead and Follow');
    expect(m.experience).toEqual({ years: 11, level: 'Veteran' });
    expect(m.practice).toMatchObject({ status: 'Up for practice', lookingFor: 'Leader', levels: ['Intermediate'], goals: ['Footwork'] });
    expect(m.styles).toEqual(['Sensual', 'Dominican']);
    expect(m.songs).toEqual(['Obsesion']);
    expect(m.highlights).toEqual(['Best newcomer 2022']);
    expect(m.gallery).toHaveLength(2);
    expect(m.contacts.map((c) => c.kind)).toEqual(['instagram', 'facebook', 'website']);
    expect(m.contacts[0].label).toBe('@carla');
    expect(m.contacts[1].label).toBe('facebook.com/carla.ruiz');
  });

  it.each([
    ['without bio', NO_EXTRAS, null],
    ['with bio', EXTRAS.full, 'I dance every Friday.'],
    ['blank bio', { ...NO_EXTRAS, bio: '   ' }, null],
  ] as [string, PublicPageExtras, string | null][])('%s', (_n, extras, bio) => {
    expect(page('photoless', extras).bio).toBe(bio);
  });

  it('many languages: all kept, blanks dropped', () => {
    expect(page('photoless', EXTRAS.manyLanguages).languages).toEqual(['English', 'Spanish', 'Portuguese', 'French', 'Italian', 'Polish']);
  });

  // F4: prod stores ISO codes. Codes become names; a code Intl cannot name is hidden, never shown raw.
  it.each([
    ['ISO codes (prod shape)', EXTRAS.isoCodes, ['English', 'Spanish', 'Italian', 'German']],
    ['unknown codes and garbage', EXTRAS.unknownCodes, []],
    ['code + stored full name + region, deduped', EXTRAS.mixed, ['English', 'Spanish', 'Brazilian Portuguese']],
    ['full names already stored', EXTRAS.full, ['English', 'Spanish']],
    ['none', NO_EXTRAS, []],
  ] as [string, PublicPageExtras, string[]][])('languages: %s', (_n, extras, expected) => {
    expect(page('photoless', extras).languages).toEqual(expected);
  });

  it.each([
    ['WhatsApp on (RPC returned a number)', EXTRAS.full, 'https://wa.me/447700900123'],
    ['WhatsApp off (RPC returned null)', NO_EXTRAS, null],
    ['WhatsApp junk (too few digits)', { ...NO_EXTRAS, whatsapp: '12' }, null],
  ] as [string, PublicPageExtras, string | null][])('%s', (_n, extras, href) => {
    const m = page('photoless', extras);
    expect(m.whatsappHref).toBe(href);
    expect(m.contacts.some((c) => c.kind === 'whatsapp')).toBe(href !== null);
  });

  it('gallery: NULL elements in the text[] are dropped, not a crash', () => {
    expect(buildPublicDancerPage(mapDancerPublicProfile(SHAPES.photoless as never), NO_EXTRAS, ['https://a.test/1.jpg', null, '', 7]).gallery).toEqual(['https://a.test/1.jpg']);
  });

  it('gallery is capped at 12 like today', () => {
    const many = Array.from({ length: 20 }, (_, i) => `https://cdn.example.test/${i}.jpg`);
    expect(buildPublicDancerPage(mapDancerPublicProfile(SHAPES.photoless as never), NO_EXTRAS, many).gallery).toHaveLength(12);
  });
});

describe('share title (F18)', () => {
  it('NAMELESS_SHARE_TITLE is pinned', () => {
    expect(NAMELESS_SHARE_TITLE).toBe('Dancer on Bachata Calendar');
  });

  it.each([
    ['nameless', NAMELESS_SHARE_TITLE],
    ['complete + all extras', 'Carla Ruiz on Bachata Calendar'],
    ['surname hidden', 'Fay on Bachata Calendar'],
  ] as const)('%s shares as %s', (key, title) => {
    expect(page(key).shareTitle).toBe(title);
  });
});

describe('helpers', () => {
  it('whatsappHref keeps digits only', () => {
    expect(whatsappHref('+44 7700 900-123')).toBe('https://wa.me/447700900123');
    expect(whatsappHref(null)).toBeNull();
    // The save RPC accepts local numbers; this is a UK site.
    expect(whatsappHref('07123 456789')).toBe('https://wa.me/447123456789');
    expect(whatsappHref('0034 612 345 678')).toBe('https://wa.me/34612345678');
  });

  // F16: a "(0)" after the country code is dropped; a number it cannot normalise gets no button.
  it.each([
    ['+44 7700 900123', 'https://wa.me/447700900123'],
    ['+44 (0)7700 900123', 'https://wa.me/447700900123'],
    ['+44(0)7700900123', 'https://wa.me/447700900123'],
    ['0044 (0)7700 900123', 'https://wa.me/447700900123'],
    ['07700 900123', 'https://wa.me/447700900123'],
    ['+34 612 345 678', 'https://wa.me/34612345678'],
    ['+44 07700 900123', 'https://wa.me/447700900123'],
    ['+1 415 555 0100 2222 333', null],
    ['7700900123', null],
    ['12', null],
    ['+44 12', null],
    ['call me', null],
    ['07700 9001ab', null],
    ['+44 7700 900123 ext 5', null],
    ['', null],
    ['   ', null],
  ] as [string, string | null][])('whatsappHref(%j) = %s', (raw, href) => {
    expect(whatsappHref(raw)).toBe(href);
  });

  it('joinHref returns to the same page after sign-in', () => {
    expect(joinHref('/dancers/ana-lopez')).toBe('/auth?mode=signup&returnTo=%2Fdancers%2Fana-lopez');
  });

  it.each([
    ['web share works', { share: async () => undefined }, 'shared'],
    ['share sheet closed by the person', { share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); } }, 'cancelled'],
    ['share fails, clipboard works', { share: async () => { throw new Error('no'); }, writeText: async () => undefined }, 'copied'],
    ['no share, clipboard works', { writeText: async () => undefined }, 'copied'],
    ['nothing works', { writeText: async () => { throw new Error('denied'); } }, 'manual'],
  ] as const)('share: %s -> %s', async (_n, env, outcome) => {
    expect(await shareDancerPage(env, 't', 'https://x.test/dancers/a')).toBe(outcome);
  });

  it('every visible share outcome has a plain message', () => {
    expect(SHARE_MESSAGES.copied).toMatch(/Link copied/);
    expect(SHARE_MESSAGES.manual).toMatch(/Copy this link/);
  });
});

describe('facts: an unanswered start year is not a fact (W1 S2)', () => {
  const withYear = (y: number | null) => {
    const rec = { ...SHAPES['complete + all extras'], dancing_role_details: { dance_started_year: y } };
    return buildPublicDancerPage(mapDancerPublicProfile(rec as never), NO_EXTRAS, []);
  };
  it.each([
    [null, null, null],
    [2026, null, null], // this year = the default a brand-new row carries (Chi-Wei)
    [2025, '1 year', 'Rising'],
    [2015, '11 years', 'Veteran'],
  ] as const)('start year %s -> dancing %s, level %s', (y, dancing, level) => {
    const m = withYear(y);
    expect(m.facts.dancing).toBe(dancing);
    expect(m.facts.level).toBe(level);
  });
});
