import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { classifyCatchallPath } from '../app/catchallGate';

// app/catchallGate.ts answers 200 only for the paths in CATCHALL_CLIENT_PATHS.
// A <Route> added to AnimatedRoutes without updating that list would serve its
// page at HTTP 404, so the two must hold the same patterns.
describe('CATCHALL_CLIENT_PATHS mirrors AnimatedRoutes', () => {
  it('has exactly the <Route path> literals, minus "*"', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/components/AnimatedRoutes.tsx'), 'utf8');
    const routed = [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');
    expect(routed.length).toBeGreaterThan(20);
    expect([...CATCHALL_CLIENT_PATHS].sort()).toEqual([...new Set(routed)].sort());
  });

  it('classifies every client pattern as a page, never as unknown', () => {
    for (const pattern of CATCHALL_CLIENT_PATHS) {
      const concrete = pattern.replace(/:\w+\??/g, 'x-gb').replace('*', 'a/b');
      expect(classifyCatchallPath(concrete).kind, pattern).not.toBe('unknown');
    }
  });
});
