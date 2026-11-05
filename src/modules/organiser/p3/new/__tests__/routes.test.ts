import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { P3_PATHS } from '../../shell/paths';
import { isPushed, tabOf } from '../../shell/P3Shell';
import { P3_SURFACE } from '../../you/surface';

/*
 * p3-create slice 1: where New event lives. Its URLs sit under Events (the tab it returns to), draw
 * their own top bar, every "Add an event" (Home, Events, Welcome) opens it, and its chunk is lazy.
 */

const P3_DIR = join(process.cwd(), 'src/modules/organiser/p3');

describe('New event in the P3 frame', () => {
  it.each([P3_PATHS.create, `${P3_PATHS.create}/`])('%s is a pushed Events screen', (path) => {
    expect(tabOf(path)).toBe('events');
    expect(isPushed(path)).toBe(true);
  });

  it('the shared screens (Welcome "Add an event", Help "New event") open P3 New event', () => {
    expect(P3_SURFACE.paths.newWhat).toBe(P3_PATHS.create);
    expect(P3_SURFACE.paths.newWhatFor('org1')).toBe(P3_PATHS.createFor('org1'));
    expect(P3_SURFACE.paths.newWhatFor(null)).toBe(P3_PATHS.create);
  });

  it('no P3 link opens the old bridge (new/what) any more', () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) return f === '__tests__' ? [] : files(full);
      return /\.tsx?$/.test(f) ? [full] : [];
    });
    for (const f of files(P3_DIR)) {
      // paths.ts defines the old URLs, P3Shell keeps them in the frame while they redirect, and the surface
      // keeps R1's step keys (only R1's wizard reads them, and P3 no longer mounts it) pointing at those redirects
      if (['shell/paths.ts', 'shell/P3Shell.tsx', 'you/surface.tsx'].some((x) => f.endsWith(x))) continue;
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/P3_PATHS\.(newWhat|newName|newVenue|newDate|newTime|newCover)\b/);
    }
  });

  it('P3Routes loads New event lazily (none of it on the first load), and no longer mounts the R1 wizard', () => {
    const src = readFileSync(join(P3_DIR, 'shell/P3Routes.tsx'), 'utf8');
    expect(src).toMatch(/lazyWithRetry\(\(\) => import\('\.\.\/new\/CreateFlow'\)\)/);
    expect(src).not.toMatch(/^import .*['"]\.\.\/new\//m);
    expect(src).not.toMatch(/flows\/new/);
  });
});
