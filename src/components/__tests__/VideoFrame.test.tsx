// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { VideoFrame } from '@/components/VideoFrame';
import VideoBlock from '@/modules/event-page/bento/blocks/VideoBlock';
import VenueVideoEmbed from '@/components/venue/VenueVideoEmbed';
import { parseVenueVideoUrl, type VenueVideo } from '@/lib/parseVenueVideoUrl';
import { readFileSync } from 'node:fs';

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
const ar = (el: HTMLElement) => parseFloat(el.style.aspectRatio);

const direct: VenueVideo = { kind: 'direct', src: 'https://x.test/a.mp4' };
const ID = 'dQw4w9WgXcQ';

const size = (el: HTMLVideoElement, w: number, h: number) => {
  Object.defineProperty(el, 'videoWidth', { value: w, configurable: true });
  Object.defineProperty(el, 'videoHeight', { value: h, configurable: true });
  fireEvent.loadedMetadata(el);
};
const frameBox = (c: HTMLElement) => c.querySelector('[data-video-frame]') as HTMLElement;

describe('VideoFrame', () => {
  it('direct starts 16:9 then adapts to portrait and back', () => {
    const { container } = render(<VideoFrame video={direct} title="t" />);
    expect(frameBox(container).className).toContain('aspect-video');
    const v = container.querySelector('video')!;
    size(v, 480, 848);
    expect(frameBox(container).className).not.toContain('aspect-video');
    expect(ar(frameBox(container))).toBeCloseTo(480 / 848);
    expect(v.className).toContain('object-contain');
    size(v, 848, 474);
    expect(frameBox(container).className).toContain('aspect-video');
    expect(v.className).toContain('object-cover');
  });
  it('shorts is adaptive immediately', () => {
    const { container } = render(<VideoFrame video={parseVenueVideoUrl(`https://youtube.com/shorts/${ID}?feature=share`)!} title="t" />);
    expect(ar(frameBox(container))).toBeCloseTo(9 / 16);
  });
  it.each([`https://youtu.be/${ID}`, 'https://vimeo.com/123456'])('%s stays landscape', (u) => {
    const { container } = render(<VideoFrame video={parseVenueVideoUrl(u)!} title="t" />);
    expect(frameBox(container).className).toContain('aspect-video');
  });
});

describe('source change on a mounted frame', () => {
  const directB: VenueVideo = { kind: 'direct', src: 'https://x.test/b.mp4' };
  const watch = parseVenueVideoUrl(`https://youtu.be/${ID}`)!;
  it('VideoFrame: portrait clip then YouTube watch is landscape', () => {
    const { container, rerender } = render(<VideoFrame video={direct} title="t" />);
    size(container.querySelector('video')!, 480, 848);
    expect(frameBox(container).className).not.toContain('aspect-video');
    rerender(<VideoFrame video={watch} title="t" />);
    expect(frameBox(container).className).toContain('aspect-video');
    expect(frameBox(container).style.aspectRatio).toBe('');
  });
  it('VideoFrame: portrait A then direct B adapts only to B', () => {
    const { container, rerender } = render(<VideoFrame video={direct} title="t" />);
    size(container.querySelector('video')!, 480, 848);
    rerender(<VideoFrame video={directB} title="t" />);
    expect(frameBox(container).className).toContain('aspect-video');
    size(container.querySelector('video')!, 848, 474);
    expect(frameBox(container).className).toContain('aspect-video');
    size(container.querySelector('video')!, 480, 848);
    expect(ar(frameBox(container))).toBeCloseTo(480 / 848);
  });
  it('VenueVideoEmbed: portrait clip then YouTube watch is landscape', () => {
    const { container, rerender } = render(<VenueVideoEmbed videoUrls={['https://x.test/a.mp4']} />);
    size(container.querySelector('video')!, 480, 848);
    expect(frameBox(container).className).not.toContain('aspect-video');
    rerender(<VenueVideoEmbed videoUrls={[`https://youtu.be/${ID}`]} />);
    expect(frameBox(container).className).toContain('aspect-video');
    expect(frameBox(container).style.aspectRatio).toBe('');
  });
  it('VenueVideoEmbed: portrait A then direct B adapts only to B', () => {
    const { container, rerender } = render(<VenueVideoEmbed videoUrls={['https://x.test/a.mp4']} />);
    size(container.querySelector('video')!, 480, 848);
    rerender(<VenueVideoEmbed videoUrls={['https://x.test/b.mp4']} />);
    expect(frameBox(container).className).toContain('aspect-video');
    size(container.querySelector('video')!, 848, 474);
    expect(frameBox(container).className).toContain('aspect-video');
    size(container.querySelector('video')!, 480, 848);
    expect(ar(frameBox(container))).toBeCloseTo(480 / 848);
  });
});

describe('metadata already loaded before React attaches onLoadedMetadata (SSR + hydrate)', () => {
  const setProto = (state: number, w: number, h: number) => {
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { value: state, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: w, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: h, configurable: true });
  };
  afterEach(() => {
    delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).readyState;
    delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).videoWidth;
    delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).videoHeight;
  });
  const surfaces: [string, () => JSX.Element][] = [
    ['VideoFrame', () => <VideoFrame video={direct} title="t" />],
    ['VenueVideoEmbed', () => <VenueVideoEmbed videoUrls={['https://x.test/a.mp4']} />],
  ];
  describe.each(surfaces)('%s', (_n, make) => {
    it('portrait 480x848 with no event is adaptive', () => {
      setProto(4, 480, 848);
      const { container } = render(make());
      expect(ar(frameBox(container))).toBeCloseTo(480 / 848);
      expect(container.querySelector('video')!.className).toContain('object-contain');
    });
    it('landscape 848x474 with no event stays landscape', () => {
      setProto(4, 848, 474);
      const { container } = render(make());
      expect(frameBox(container).className).toContain('aspect-video');
      expect(container.querySelector('video')!.className).toContain('object-cover');
    });
    it('readyState 0 with no event stays landscape', () => {
      setProto(0, 0, 0);
      const { container } = render(make());
      expect(frameBox(container).className).toContain('aspect-video');
    });
  });
  it('real sequence: renderToString, then hydrateRoot, no event', async () => {
    const html = renderToString(<VideoFrame video={direct} title="t" />);
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    setProto(4, 480, 848);
    await act(async () => {
      hydrateRoot(host, <VideoFrame video={direct} title="t" />);
    });
    expect(frameBox(host).className).not.toContain('aspect-video');
    expect(ar(frameBox(host))).toBeCloseTo(480 / 848);
    host.remove();
  });
});

describe('cross-surface consistency', () => {
  it('VideoBlock and VenueVideoEmbed give the same portrait frame', () => {
    const a = render(<VideoBlock video={direct} poster={null} title="t" />);
    size(a.container.querySelector('video')!, 720, 1280);
    const b = render(<VenueVideoEmbed videoUrls={['https://x.test/a.mp4']} />);
    size(b.container.querySelector('video')!, 720, 1280);
    const sa = frameBox(a.container).style;
    const sb = frameBox(b.container).style;
    expect(sa.aspectRatio).toBe(sb.aspectRatio);
    expect(parseFloat(sa.aspectRatio)).toBeCloseTo(720 / 1280);
    expect(sa.width).toBe(sb.width);
    expect(sa.width).toContain('75svh');
  });
  it('venue: TikTok and .html render nothing', () => {
    expect(render(<VenueVideoEmbed videoUrls={['https://www.tiktok.com/@a/video/1']} />).container.innerHTML).toBe('');
    expect(render(<VenueVideoEmbed videoUrls={['https://x.com/p.html']} />).container.innerHTML).toBe('');
  });
  it('venue: shorts iframe is adaptive, watch stays 16:9', () => {
    const s = render(<VenueVideoEmbed videoUrls={[`https://youtube.com/shorts/${ID}`]} />);
    expect(ar(frameBox(s.container))).toBeCloseTo(9 / 16);
    const w = render(<VenueVideoEmbed videoUrls={[`https://youtu.be/${ID}`]} />);
    expect(frameBox(w.container).className).toContain('aspect-video');
  });
  it.each([[640, 360], [848, 474], [848, 478]])('prod landscape clip %ix%i unchanged', (w, h) => {
    const { container } = render(<VideoFrame video={direct} title="t" />);
    size(container.querySelector('video')!, w, h);
    expect(frameBox(container).className).toContain('aspect-video');
  });
  it('guard: no forced 16:9 / 56.25% box left around players', () => {
    const vb = readFileSync('src/modules/event-page/bento/blocks/VideoBlock.tsx', 'utf8');
    expect(vb).not.toMatch(/aspect-video|56\.25%/);
    const ve = readFileSync('src/components/venue/VenueVideoEmbed.tsx', 'utf8');
    expect(ve).not.toMatch(/56\.25%/);
    expect(ve).toContain('frameStyle');
    const fd = readFileSync('src/pages/FestivalDetail.tsx', 'utf8');
    expect(fd).not.toMatch(/aspect-video[^\n]*\n?[^\n]*<VideoEmbed/);
    expect(fd).toContain('<VideoFrame');
  });
});
