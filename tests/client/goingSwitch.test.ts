/**
 * The going switch: OFF on production. The ONE override is a Vercel PREVIEW
 * build with VITE_ENABLE_GOING_PREVIEW=true; production, development, a local
 * build or a missing env are OFF whatever that flag says. The real-build fold
 * is goingSwitchFold.test.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOING_CHECKIN_ENABLED, goingSwitchOn } from '@/lib/goingCheckin';

describe('goingSwitchOn', () => {
  it.each([
    ['preview', 'true', true],
    ['preview', 'false', false],
    ['preview', '1', false],
    ['preview', 'TRUE', false],
    ['preview', undefined, false],
    ['production', 'true', false],
    ['production', undefined, false],
    ['development', 'true', false],
    ['', 'true', false],
    [undefined, 'true', false],
    [null, 'true', false],
    ['Preview', 'true', false],
  ] as const)('VERCEL_ENV=%s VITE_ENABLE_GOING_PREVIEW=%s -> %s', (vercelEnv, goingPreview, on) => {
    expect(goingSwitchOn({ vercelEnv, goingPreview })).toBe(on);
  });

  it('is off in this (non-Vercel) build', () => {
    expect(GOING_CHECKIN_ENABLED).toBe(false);
  });

  it('vite.config.ts exposes VERCEL_ENV to the client as VITE_VERCEL_ENV', () => {
    const cfg = readFileSync(path.resolve(__dirname, '../../vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/"import\.meta\.env\.VITE_VERCEL_ENV":\s*JSON\.stringify\(process\.env\.VERCEL_ENV \?\? ""\)/);
  });
});
