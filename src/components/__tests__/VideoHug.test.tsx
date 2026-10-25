// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { VideoFrame } from '@/components/VideoFrame';
import VideoBlock from '@/modules/event-page/bento/blocks/VideoBlock';
import VenueVideoEmbed from '@/components/venue/VenueVideoEmbed';
import { parseVenueVideoUrl, type VenueVideo } from '@/lib/parseVenueVideoUrl';
import { VIDEO_CAP_CLASS, hugStyle, frameFor } from '@/lib/videoFrame';

// Owner decision 2026-10-20: "the tile hugs the video" -- a portrait/square
// tile is only as wide as the video and centred, with no black side bars.
// Landscape output stays exactly as it was.

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});

const ID = 'dQw4w9WgXcQ';
const CLIP = 'https://x.test/a.mp4';
const direct: VenueVideo = { kind: 'direct', src: CLIP };
const FESTIVAL_BOX = 'mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-black';
const FESTIVAL_HUG = 'max-w-3xl overflow-hidden rounded-xl border border-white/10';

type Surface = { name: string; render: (url: string) => HTMLElement; landscapeChain: string[]; chrome?: string };
const asVideo = (url: string) => (url === CLIP ? direct : parseVenueVideoUrl(url)!);
const surfaces: Surface[] = [
  {
    name: 'event tile (VideoBlock)',
    render: (u) => render(<VideoBlock video={asVideo(u)} poster={null} title="t" />).container,
    landscapeChain: ['overflow-hidden rounded-[14px]', 'w-full overflow-hidden bg-black', 'aspect-video w-full'],
  },
  {
    name: 'festival aftermovie',
    render: (u) =>
      render(<VideoFrame video={asVideo(u)} title="t" boxClassName={FESTIVAL_BOX} hugClassName={FESTIVAL_HUG} hugChrome="2px" />).container,
    landscapeChain: [FESTIVAL_BOX, 'w-full overflow-hidden bg-black', 'aspect-video w-full'],
    chrome: '2px',
  },
  {
    name: 'venue player',
    render: (u) => render(<VenueVideoEmbed videoUrls={[u]} />).container,
    landscapeChain: ['overflow-hidden rounded-[18px] border p-2', 'w-full overflow-hidden rounded-[14px] bg-black', 'relative aspect-video w-full'],
    chrome: '1rem + 2px',
  },
];

const size = (c: HTMLElement, w: number, h: number) => {
  const v = c.querySelector('video');
  if (!v) return;
  Object.defineProperty(v, 'videoWidth', { value: w, configurable: true });
  Object.defineProperty(v, 'videoHeight', { value: h, configurable: true });
  fireEvent.loadedMetadata(v);
};
const frameBox = (c: HTMLElement) => c.querySelector('[data-video-frame]') as HTMLElement;
// The three boxes from the tile down to the frame.
const chain = (c: HTMLElement) => {
  const f = frameBox(c);
  return [f.parentElement!.parentElement!, f.parentElement!, f];
};

const portraitCases: [string, string, number, number][] = [
  ['portrait 480x848 (femme-style)', CLIP, 480, 848],
  ['portrait 720x1280 (the-camden-tuesdays)', CLIP, 720, 1280],
  ['square 1000x1000', CLIP, 1000, 1000],
  ['4:3 640x480', CLIP, 640, 480],
  ['YouTube Short', `https://youtube.com/shorts/${ID}?feature=share`, 9, 16],
];
const landscapeCases: [string, string, number, number][] = [
  ['direct 848x474', CLIP, 848, 474],
  ['direct 640x360', CLIP, 640, 360],
  ['direct before metadata', CLIP, 0, 0],
  ['YouTube watch', `https://youtu.be/${ID}`, 0, 0],
  ['Vimeo', 'https://vimeo.com/123456', 0, 0],
];

describe.each(surfaces)('$name', (s) => {
  it.each(portraitCases)('%s: the tile hugs the video', (_n, url, w, h) => {
    const c = s.render(url);
    size(c, w, h);
    const [tile, inner, frame] = chain(c);
    expect(tile.hasAttribute('data-video-hug')).toBe(true);
    expect(tile.style.width).toBe(hugStyle(frameFor(w, h), s.chrome)!.width);
    expect(tile.style.width).toContain(`var(--video-cap) * ${w / h}`);
    expect(tile.className.split(' ')).toEqual(expect.arrayContaining(['mx-auto', ...VIDEO_CAP_CLASS.split(' ')]));
    expect(tile.className).not.toMatch(/\bw-full\b/);
    // No black fill around the video: only the video box itself may be black.
    expect(tile.className).not.toContain('bg-black');
    expect(inner.className).not.toContain('bg-black');
    expect(parseFloat(frame.style.aspectRatio)).toBeCloseTo(w / h);
    // Border and corners stay on the tile.
    expect(tile.className).toMatch(/rounded-\[1[48]px\]|rounded-xl/);
  });
  it.each(landscapeCases)('%s: unchanged, none of the hug classes', (_n, url, w, h) => {
    const c = s.render(url);
    if (w) size(c, w, h);
    const els = chain(c);
    expect(els.map((e) => e.className)).toEqual(s.landscapeChain);
    expect(els[0].hasAttribute('data-video-hug')).toBe(false);
    expect(els[0].style.width).toBe('');
    expect(els[2].getAttribute('style')).toBeNull();
  });
  it('portrait then landscape on the same instance drops the hug', () => {
    const c = s.render(CLIP);
    size(c, 480, 848);
    expect(chain(c)[0].hasAttribute('data-video-hug')).toBe(true);
    size(c, 848, 474);
    expect(chain(c).map((e) => e.className)).toEqual(s.landscapeChain);
  });
});

describe('landscape class strings cannot drift (source guard)', () => {
  it('festival keeps its landscape tile verbatim and passes a hug tile without bg-black or w-full', () => {
    const fd = readFileSync('src/pages/FestivalDetail.tsx', 'utf8');
    expect(fd).toContain(`boxClassName="${FESTIVAL_BOX}"`);
    expect(fd).toContain(`hugClassName="${FESTIVAL_HUG}"`);
    expect(fd).toContain('hugChrome="2px"');
  });
  it('event tile keeps its landscape box verbatim', () => {
    const vb = readFileSync('src/modules/event-page/bento/blocks/VideoBlock.tsx', 'utf8');
    expect(vb).toContain('boxClassName="overflow-hidden rounded-[14px]"');
  });
  it('venue keeps its landscape shell and inner box verbatim', () => {
    const ve = readFileSync('src/components/venue/VenueVideoEmbed.tsx', 'utf8');
    expect(ve).toContain(": 'overflow-hidden rounded-[18px] border p-2'");
    expect(ve).toContain(": 'w-full overflow-hidden rounded-[14px] bg-black'");
  });
});

describe('hugStyle', () => {
  it('landscape has none', () => expect(hugStyle(frameFor(848, 474))).toBeUndefined());
  it('same width formula as the frame; chrome is added inside the cap', () => {
    expect(hugStyle(frameFor(9, 16))!.width).toBe(`min(100%, calc(var(--video-cap) * ${9 / 16}))`);
    expect(hugStyle(frameFor(9, 16), '1rem + 2px')!.width).toBe(`min(100%, calc(var(--video-cap) * ${9 / 16} + 1rem + 2px))`);
  });
});
