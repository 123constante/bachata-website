// @vitest-environment jsdom
/**
 * React #421 seen on portrait-clip pages (live: /event/femme-style, some loads).
 * Suspected: the video's size report (useReportVideoSize / onLoadedMetadata)
 * landing while a Suspense boundary is still dehydrated.
 *
 * This guard says the video is NOT the trigger: metadata (and autoplay `play`)
 * arriving while the boundary that holds the player is still dehydrated
 * (a lazy sibling pending) leaves no recoverable error, keeps the server
 * <video>, and still applies the measured shape. Green on main before this PR
 * too. The production-build browser repro (see the PR body) agrees: #421 also
 * shows on a no-video event page and with every media event blocked.
 */
import { Suspense, lazy, type ComponentType } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { VideoFrame } from '@/components/VideoFrame';
import VenueVideoEmbed from '@/components/venue/VenueVideoEmbed';
import type { VenueVideo } from '@/lib/parseVenueVideoUrl';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  HTMLMediaElement.prototype.pause = vi.fn();
});
const setProto = (state: number, w: number, h: number) => {
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { value: state, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: w, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: h, configurable: true });
};
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
  delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).readyState;
  delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).videoWidth;
  delete (HTMLVideoElement.prototype as unknown as Record<string, unknown>).videoHeight;
});

const direct: VenueVideo = { kind: 'direct', src: 'https://x.test/a.mp4' };
const Rest = () => <p data-testid="rest">rest of the page</p>;

const players: [string, () => JSX.Element][] = [
  ['VideoFrame', () => <VideoFrame video={direct} title="t" />],
  ['VenueVideoEmbed', () => <VenueVideoEmbed videoUrls={['https://x.test/a.mp4']} />],
];
const shapes: [string, number, number, boolean][] = [
  ['portrait 480x848', 480, 848, false],
  ['portrait 720x1280', 720, 1280, false],
  ['landscape 848x474', 848, 474, true],
];
const tree = (Player: () => JSX.Element, Body: ComponentType) => (
  <Suspense fallback={<p>loading</p>}>
    <Player />
    <Body />
  </Suspense>
);

describe.each(players)('%s: metadata during hydration (#421)', (_n, Player) => {
  it.each(shapes)('%s: no recoverable error, server HTML kept, shape applied', async (_s, w, h, landscape) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(tree(Player, Rest));
    const serverVideo = container.querySelector('video')!;

    let arrive: () => void = () => {};
    const LazyRest = lazy(() => new Promise<{ default: ComponentType }>((r) => { arrive = () => r({ default: Rest }); }));
    const onRecoverableError = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, tree(Player, LazyRest), { onRecoverableError });
    });
    // The clip's metadata lands while the boundary is still dehydrated.
    setProto(1, w, h);
    await act(async () => {
      serverVideo.dispatchEvent(new Event('loadedmetadata'));
      serverVideo.dispatchEvent(new Event('play'));
    });
    await act(async () => {
      arrive();
    });

    expect(onRecoverableError.mock.calls.map((c) => String((c[0] as Error)?.message))).toEqual([]);
    expect(container.querySelector('video')).toBe(serverVideo);
    const box = container.querySelector('[data-video-frame]') as HTMLElement;
    if (landscape) expect(box.className).toContain('aspect-video');
    else expect(parseFloat(box.style.aspectRatio)).toBeCloseTo(w / h);
  });
});
