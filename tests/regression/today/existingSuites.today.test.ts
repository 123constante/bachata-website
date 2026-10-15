/**
 * The existing suites the dancer rebuild relies on as its regression gate must
 * still EXIST, be INCLUDED by the unit runner (vitest.config.ts include globs, not
 * excluded by the `test:unit` script) and not be silenced (no top-level skip/only).
 * Deleting, renaming, moving or skipping one fails here by name instead of
 * quietly shrinking the gate.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

/** gate name (as the plan names it) -> the files that carry it. */
const SUITES: Record<string, string[]> = {
  'DancerFirstGate.matrix': ['src/pages/__tests__/DancerFirstGate.matrix.test.tsx'],
  FinishProfile: ['src/pages/__tests__/FinishProfile.test.tsx'],
  FinishProfileToRating: ['src/pages/__tests__/FinishProfileToRating.test.tsx'],
  SignInSelfClaim: ['src/pages/__tests__/SignInSelfClaim.test.tsx'],
  'AuthCallback*': [
    'src/pages/__tests__/AuthCallbackDanceRole.test.tsx',
    'src/pages/__tests__/AuthCallbackFallback.test.tsx',
    'src/pages/__tests__/AuthCallbackNotice.test.tsx',
  ],
  AuthOtpDisabled: ['src/pages/__tests__/AuthOtpDisabled.test.tsx'],
  MyAttendance: ['src/pages/__tests__/MyAttendance.test.tsx'],
  AuthSignupDanceRole: ['src/pages/__tests__/AuthSignupDanceRole.test.tsx'],
  AccountSettings: ['src/pages/__tests__/AccountSettings.test.tsx'],
  accountSettings: ['src/lib/__tests__/accountSettings.test.ts'],
  rsvpBlock: ['tests/client/rsvpBlock.test.tsx'],
  catchallClientPaths: ['tests/catchallClientPaths.test.ts'],
  navigateTargetsRoutable: ['src/lib/__tests__/navigateTargetsRoutable.test.ts'],
  siteIa: ['src/lib/breadcrumbs/__tests__/siteIa.test.ts'],
};

// vitest.config.ts: include ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"]
const INCLUDED = /^(src|tests|app)\/.+\.test\.tsx?$/;

describe('regression gate: existing suites', () => {
  const unitScript = (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts['test:unit'];
  const config = readFileSync(path.join(root, 'vitest.config.ts'), 'utf8');

  it('the unit runner still includes src/, tests/ and app/ test files', () => {
    expect(config).toContain('"src/**/*.test.{ts,tsx}"');
    expect(config).toContain('"tests/**/*.test.{ts,tsx}"');
  });

  it('test:unit excludes only the EdgeTtl family', () => {
    expect(unitScript).toContain('vitest run');
    const excludes = [...unitScript.matchAll(/--exclude\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(excludes).toEqual(['**/*EdgeTtl.test.ts']);
  });

  it.each(Object.entries(SUITES).flatMap(([name, files]) => files.map((f) => [name, f] as const)))('%s: %s exists, is included, is not skipped', (_name, file) => {
    expect(existsSync(path.join(root, file)), `${file} is gone`).toBe(true);
    expect(INCLUDED.test(file), `${file} is outside the runner's include globs`).toBe(true);
    expect(file.endsWith('EdgeTtl.test.ts')).toBe(false);
    const src = readFileSync(path.join(root, file), 'utf8');
    expect(src, `${file} has a top-level skip`).not.toMatch(/^(describe|it|test)\.skip\(/m);
    expect(src, `${file} has an .only`).not.toMatch(/\b(describe|it|test)\.only\(/);
    expect(src, `${file} has no test at all`).toMatch(/\b(it|test)(\.each)?\(|\bdescribe(\.each)?\(/);
  });
});
