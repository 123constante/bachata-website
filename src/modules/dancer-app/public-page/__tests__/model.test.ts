import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { type PublicPageExtras, NO_EXTRAS, SHARE_MESSAGES, buildPublicDancerPage, joinHref, shareDancerPage, whatsappHref } from '../model';
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
    expect(m.initial).toBe(name.charAt(0));
    if (place) expect(m.place).toBe(place);
  });

  it('surname hidden: the model has only the masked name (no surname anywhere)', () => {
    expect(JSON.stringify(page('surname hidden'))).not.toContain('Secret');
  });

  it('photoless: no avatar, the initial stands in', () => {
    const m = page('photoless');
    expect(m.avatarUrl).toBeNull();
    expect(m.initial).toBe('D');
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

describe('helpers', () => {
  it('whatsappHref keeps digits only', () => {
    expect(whatsappHref('+44 7700 900-123')).toBe('https://wa.me/447700900123');
    expect(whatsappHref(null)).toBeNull();
    // The save RPC accepts local numbers; this is a UK site.
    expect(whatsappHref('07123 456789')).toBe('https://wa.me/447123456789');
    expect(whatsappHref('0034 612 345 678')).toBe('https://wa.me/34612345678');
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
