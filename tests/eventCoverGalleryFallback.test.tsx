// An event with a gallery picture but no cover rendered the pink title card in
// the cover tile (/event/ronald-alba-halloween-edition-sensual-vibes,
// 2026-10-20): the snapshot mapping set imageUrl from the cover alone, and
// CoverBlock only renders its slides when imageUrl is set. The rule now lives
// in ONE place (pickEventCoverSource, applied in parseEventPageSnapshot and the
// OG card data), and this matrix asserts every surface that shows "the event's
// picture" resolves the same one for every real shape.
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fixture from './fixtures/galleryOnlyEventSnapshot.json';

const io = vi.hoisted(() => ({ payload: null as unknown }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: io.payload, error: null }) },
}));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

import { parseEventPageSnapshot } from '@/modules/event-page/useEventPageQuery';
import { buildEventPageModel } from '@/modules/event-page/buildEventPageModel';
import { CoverBlock } from '@/modules/event-page/bento/blocks/CoverBlock';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { fetchEventCardData } from '../app/lib/ogCardRender';

const C = 'https://media.bachatacalendar.co.uk/images/events/cover/c.webp';
const G1 = 'https://media.bachatacalendar.co.uk/images/events/gallery/g1.webp';
const G2 = 'https://media.bachatacalendar.co.uk/images/events/gallery/g2.webp';

const H = 'https://media.bachatacalendar.co.uk/images/events/hero/h.webp';

const payloadWith = (cover: string | null, gallery: string[], hero: string | null = cover) => ({
  ...fixture,
  event: { ...fixture.event, cover_image_url: cover, hero_image_url: hero, photo_urls: gallery },
});

// What each surface resolves "the event's picture" to, read the way the real
// render reads it. BentoPage passes snapshot.event.imageUrl to CoverBlock, to
// VideoBlock as its poster, to buildEventJsonLd as `image`, and the loader
// passes it to resolveOgCardImage as og:image's coverUrl. Those three call
// sites read the field verbatim, so their rows pin the field they read; the
// cover tile (real SSR render) and the share card (real fetchEventCardData)
// run the actual code.
const surfaces = async (payload: unknown) => {
  const snapshot = parseEventPageSnapshot(payload);
  if (!snapshot) throw new Error('fixture did not parse');
  const model = buildEventPageModel({ snapshot, canEdit: false, isLoading: false, hasError: false });
  const markup = renderToStaticMarkup(
    createElement(CoverBlock, {
      imageUrl: snapshot.event.imageUrl,
      galleryUrls: model.galleryUrls,
      title: model.identity.title,
      dateLabel: null,
      venueName: null,
    }),
  );
  const imgSrcs = [...markup.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  io.payload = payload;
  const card = await fetchEventCardData(fixture.event_id, null);
  return {
    coverTile: imgSrcs[0] ?? null,
    slideCount: imgSrcs.length,
    videoPoster: snapshot.event.imageUrl,
    jsonLdImage: snapshot.event.imageUrl ? [snapshot.event.imageUrl] : null,
    ogCoverUrl: snapshot.event.imageUrl,
    shareCard: card?.coverUrl ?? null,
    hero: model.hero.imageUrl,
  };
};

const SHAPES: Array<{ name: string; cover: string | null; gallery: string[]; hero?: string | null; picture: string | null; slides: number }> = [
  { name: 'cover only', cover: C, gallery: [], picture: C, slides: 1 },
  { name: 'gallery only (the Ronald & Alba shape)', cover: null, gallery: [G1], picture: G1, slides: 1 },
  { name: 'cover also in the gallery (no duplicate slide)', cover: C, gallery: [C], picture: C, slides: 1 },
  { name: 'cover plus other gallery pictures', cover: C, gallery: [G1, G2], picture: C, slides: 3 },
  { name: 'neither (title card stays)', cover: null, gallery: [], picture: null, slides: 0 },
  { name: 'cover empty string, gallery present', cover: '', gallery: [G1], picture: G1, slides: 1 },
  { name: 'cover whitespace, gallery present', cover: '   ', gallery: [G1, G2], picture: G1, slides: 2 },
  { name: 'cover whitespace, no gallery', cover: '  ', gallery: [], picture: null, slides: 0 },
  { name: 'gallery with an empty first entry', cover: null, gallery: ['', G2], picture: G2, slides: 1 },
  { name: 'hero but no cover beats the gallery', cover: null, hero: H, gallery: [G1], picture: H, slides: 2 },
  { name: 'padded gallery entry (no duplicate slide)', cover: null, gallery: [` ${G1} `], picture: G1, slides: 1 },
  { name: "stringified 'null' cover, gallery present", cover: 'null', hero: null, gallery: [G1], picture: G1, slides: 1 },
];

describe('event picture: every surface agrees for every shape', () => {
  it.each(SHAPES)('$name', async ({ cover, gallery, hero, picture, slides }) => {
    const s = await surfaces(payloadWith(cover, gallery, hero === undefined ? cover : hero));
    expect(s.coverTile).toBe(picture ? optimizedImageUrl(picture, 640) : null);
    expect(s.slideCount).toBe(slides);
    expect(s.videoPoster).toBe(picture);
    expect(s.jsonLdImage).toEqual(picture ? [picture] : null);
    expect(s.ogCoverUrl).toBe(picture);
    expect(s.shareCard).toBe(picture);
    expect(s.hero).toBe(picture);
  });
});

describe('the dehydrated slug payload (gallery only, no cover)', () => {
  it('shows the gallery picture in the cover tile, not the title card', async () => {
    const s = await surfaces(fixture);
    const picture = fixture.event.photo_urls[0];
    expect(s.coverTile).toBe(optimizedImageUrl(picture, 640));
    expect(s.slideCount).toBe(1);
    expect(s.ogCoverUrl).toBe(picture);
    expect(s.shareCard).toBe(picture);
  });
});
