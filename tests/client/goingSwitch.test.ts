/**
 * The going switch: OFF on production. The ONE override is a Vercel PREVIEW
 * build with VITE_GOING_PREVIEW=1; production, development, a local build or a
 * missing env are OFF whatever VITE_GOING_PREVIEW says.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOING_CHECKIN_ENABLED, goingSwitchOn } from '@/lib/goingCheckin';

describe('goingSwitchOn', () => {
  it.each([
    ['preview', '1', true],
    ['preview', '0', false],
    ['preview', 'true', false],
    ['preview', undefined, false],
    ['production', '1', false],
    ['production', undefined, false],
    ['development', '1', false],
    ['', '1', false],
    [undefined, '1', false],
    [null, '1', false],
    ['Preview', '1', false],
  ] as const)('VERCEL_ENV=%s VITE_GOING_PREVIEW=%s -> %s', (vercelEnv, goingPreview, on) => {
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
