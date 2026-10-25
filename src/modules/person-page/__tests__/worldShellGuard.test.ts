/**
 * People arc S3b: a world never wraps PersonFrame in its own padding or width. The owner saw
 * Back move 4px right and 3px down between the DJ and dancer worlds because each page padded the
 * frame itself. Every file that renders <PersonFrame must render it inside <WorldPage (frame/),
 * with no padding / width / min-height class or style between the two.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' || n === 'node_modules' ? [] : files(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });

const FRAME_DIR = join(SRC, 'modules/person-page/frame');
const users = files(SRC).filter((p) => !p.startsWith(FRAME_DIR) && /<PersonFrame\b/.test(readFileSync(p, 'utf8')));
const PADDING = /\b(?:p[xytblr]?|max-w|min-h)-[\w[\]().%-]+|\b(?:padding|maxWidth|minHeight)\s*:/;

/** The source between each <PersonFrame and the nearest <WorldPage before it (null = none). */
export const between = (src: string): (string | null)[] =>
  [...src.matchAll(/<PersonFrame\b/g)].map((m) => {
    const open = src.lastIndexOf('<WorldPage', m.index);
    return open < 0 ? null : src.slice(src.indexOf('>', open) + 1, m.index);
  });

describe('world shell guard', () => {
  it('finds the DJ page (the guard is not looking at nothing)', () => {
    expect(users.map((p) => relative(SRC, p))).toContain('pages/DJProfile.tsx');
  });

  it.each(users.map((p) => [relative(SRC, p), p]))('%s renders PersonFrame straight inside WorldPage', (_n, p) => {
    for (const gap of between(readFileSync(p, 'utf8'))) {
      expect(gap, 'PersonFrame outside a WorldPage').not.toBeNull();
      expect(gap).not.toMatch(PADDING);
    }
  });

  it('catches a world that pads the frame itself (canary)', () => {
    const bad = '<WorldPage world="dj">\n<div className="px-4 pt-3">\n<PersonFrame />';
    expect(between(bad)[0]).toMatch(PADDING);
    expect(between('<GlobalLayout><div className="px-3"><PersonFrame />')[0]).toBeNull();
    expect(between('<WorldPage world="dj" head={x}>\n  <PersonFrame />')[0]).not.toMatch(PADDING);
  });
});
