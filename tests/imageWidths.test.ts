/**
 * imageWidths.test.ts -- CI home for scripts/check-image-widths.mjs.
 *
 * The checks-manifest law: a script that exposes --self-test but is not wired
 * into something CI runs is a proof nobody collects. The guard is in the `lint`
 * chain (architecture-guard.yml) as a SCANNER; this is where its own
 * both-directions assertions run, inside unit-tests.yml and the pre-push gate.
 *
 * Origin: PR #178 shipped a 22px organiser thumbnail asking for a width
 * vercel.json does not declare, so Vercel answered 400 and six thumbnails
 * rendered blank on production for three days.
 *
 * NOTE: the incident value is assembled from parts below rather than written
 * out. The scanner strips comments and strings before matching, so a literal
 * would be safe today -- but this spec must not become the reason a future
 * widening of the scan directories reds the tree.
 */
import { describe, expect, it } from 'vitest';
import {
  checkTree,
  classifyArg,
  findCalls,
  readHelperDefaultQualities,
  readHelperDefaultQuality,
  readHelperSizes,
  readVercelImages,
  scanSource,
  selfTestFailures,
} from '../scripts/check-image-widths.mjs';

const BAD_WIDTH = 80;
const incidentCall = (w: string) => ['cssUrl(e.poster_url, ', w, ')'].join('');

describe('image-width contract', () => {
  it('passes its own both-directions self-test', () => {
    const { total, failures } = selfTestFailures();
    expect(failures).toEqual([]);
    expect(total).toBeGreaterThan(20);
  });

  it('the live tree declares no width or quality Vercel would 400 on', () => {
    const { violations, calls, scanned } = checkTree();
    expect(violations).toEqual([]);
    // A scanner that found nothing reports the same empty array, so assert it
    // actually measured -- the fail-loud measurement contract.
    expect(calls).toBeGreaterThan(0);
    expect(scanned).toBeGreaterThan(0);
  });

  it('rule 1: imageCdn.ts SIZES equals images.sizes (what makes srcWidthFor safe)', () => {
    expect(readHelperSizes()).toEqual(readVercelImages().sizes);
  });

  it('rule 2: the default quality every call site inherits is one Vercel serves', () => {
    expect(readVercelImages().qualities).toContain(readHelperDefaultQuality());
  });

  it('rule 2 covers EVERY helper, not just optimizedImageUrl', () => {
    // cssUrl declares its own `quality = 70` and forwards it, so the background
    // -image surface -- invisible to any <img> sweep -- has an independent
    // default. Checking one helper left the other unguarded.
    const defaults = readHelperDefaultQualities();
    const { qualities } = readVercelImages();
    expect(defaults.map((d) => d.helper)).toContain('cssUrl');
    for (const { helper, quality } of defaults) {
      expect(quality, `${helper} default quality could not be read`).not.toBeNull();
      expect(qualities, `${helper} default quality`).toContain(quality);
    }
  });

  it('RED: the exact call that shipped the incident is rejected', () => {
    const [call] = findCalls(incidentCall(String(BAD_WIDTH)));
    expect(call.width).toEqual({ kind: 'decimal', value: BAD_WIDTH });
    expect(readVercelImages().sizes).not.toContain(BAD_WIDTH);
  });

  it('RED: the same value in a spelling that used to evade the guard', () => {
    // 0x50 === 80. Classifying it as "dynamic" is how it would have shipped.
    expect(classifyArg('0x50').kind).toBe('odd-numeric');
    expect(classifyArg('+80').kind).toBe('odd-numeric');
  });

  it('GREEN: the fix is not flagged, because srcWidthFor(22) is not a literal', () => {
    expect(findCalls(incidentCall('srcWidthFor(22)'))[0].width.kind).toBe('dynamic');
  });

  it('a documented or stringified example is never mistaken for a call site', () => {
    expect(scanSource('// ' + incidentCall(String(BAD_WIDTH)))).toHaveLength(0);
    expect(scanSource(['const s = "', incidentCall('80'), '";'].join(''))).toHaveLength(0);
    expect(scanSource('const a = ' + incidentCall('96') + ';')).toHaveLength(1);
  });
});
