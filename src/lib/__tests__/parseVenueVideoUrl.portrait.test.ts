import { describe, expect, it } from 'vitest';
import { parseVenueVideoUrl, pickPlayableVideo } from '@/lib/parseVenueVideoUrl';

const ID = 'dQw4w9WgXcQ';

describe('parseVenueVideoUrl portrait flag', () => {
  const cases: Array<[string, string, string | null, boolean | undefined]> = [
    ['watch', `https://www.youtube.com/watch?v=${ID}`, 'youtube', false],
    ['youtu.be', `https://youtu.be/${ID}`, 'youtube', false],
    ['embed', `https://www.youtube.com/embed/${ID}`, 'youtube', false],
    ['shorts', `https://www.youtube.com/shorts/${ID}`, 'youtube', true],
    ['shorts feature=share', `https://www.youtube.com/shorts/${ID}?feature=share`, 'youtube', true],
    ['shorts si', `https://www.youtube.com/shorts/${ID}?si=abc123`, 'youtube', true],
    ['shorts no www', `https://youtube.com/shorts/${ID}`, 'youtube', true],
    ['shorts uppercase', `https://WWW.YouTube.com/Shorts/${ID}`, 'youtube', true],
    ['vimeo', 'https://vimeo.com/123456789', 'vimeo', undefined],
    ['player.vimeo', 'https://player.vimeo.com/video/123456789', 'vimeo', undefined],
    ['mp4', 'https://cdn.example.com/a.mp4', 'direct', undefined],
    ['mov', 'https://cdn.example.com/a.mov', 'direct', undefined],
    ['webm', 'https://cdn.example.com/a.webm', 'direct', undefined],
    ['m4v', 'https://cdn.example.com/a.m4v', 'direct', undefined],
    ['mp4 query', 'https://cdn.example.com/a.mp4?x=1', 'direct', undefined],
  ];
  it.each(cases)('%s', (_n, url, kind, portrait) => {
    const r = parseVenueVideoUrl(url);
    expect(r?.kind ?? null).toBe(kind);
    if (r?.kind === 'youtube') expect(r.portrait).toBe(portrait);
  });
  it.each([['blank', '  '], ['junk', 'not a url'], ['tiktok', 'https://www.tiktok.com/@a/video/123'], ['html', 'https://x.com/page.html']])(
    '%s returns null',
    (_n, url) => expect(parseVenueVideoUrl(url)).toBeNull(),
  );
  it('series: first playable wins', () => {
    const r = pickPlayableVideo(['https://x.com/p.html', `https://youtu.be/${ID}`, `https://youtube.com/shorts/${ID}`]);
    expect(r?.kind === 'youtube' && r.portrait).toBe(false);
  });
});
