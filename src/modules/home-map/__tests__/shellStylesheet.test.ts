import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The homepage shell (chips, poster rows, cards) is styled by homeMap.css. It
// must be a STATIC import of the server-rendered shell, so it ships as a route
// stylesheet. When it only came in through the lazy EventMap chunk, a failed
// map CSS load left the whole homepage unstyled while the map still drew.
describe('home shell stylesheet', () => {
  it('HomeMapShell imports homeMap.css statically', () => {
    const src = readFileSync(resolve(__dirname, '../HomeMapShell.tsx'), 'utf8');
    expect(src).toMatch(/^import '\.\/homeMap\.css';$/m);
  });
});
