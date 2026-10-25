/**
 * The going switch folds at BUILD time (review R7). goingSwitch.test.ts checks
 * the pure rule, but vitest does not apply vite.config.ts `define`, so nothing
 * there proves a production build cannot switch going on. This runs a real Vite
 * build of a tiny entry that imports src/lib/goingCheckin.ts, with the repo's
 * own `define` (vite.config.ts evaluated under each env), and asserts the
 * built value. It also asserts no import.meta.env read survives, so a later
 * swap of the define for a raw env read turns this red.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { build, loadConfigFromFile } from 'vite';

const ROOT = path.resolve(__dirname, '../..');
const work = mkdtempSync(path.join(tmpdir(), 'going-fold-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const ENV_KEYS = ['VERCEL_ENV', 'VITE_ENABLE_GOING_PREVIEW', 'VITE_VERCEL_ENV'] as const;

async function buildSwitch(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, tag: string) {
  const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production', isSsrBuild: false },
      path.join(ROOT, 'vite.config.ts'),
      ROOT,
      'silent',
    );
    const define = (loaded?.config as { define?: Record<string, string> }).define;
    const entry = path.join(work, `entry-${tag}.ts`);
    writeFileSync(
      entry,
      `export { GOING_CHECKIN_ENABLED } from ${JSON.stringify(path.join(ROOT, 'src/lib/goingCheckin.ts'))};\n`,
    );
    const outDir = path.join(work, `out-${tag}`);
    await build({
      configFile: false,
      logLevel: 'silent',
      root: work,
      define,
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        lib: { entry, formats: ['es'], fileName: () => 'switch.mjs' },
      },
    });
    const file = path.join(outDir, 'switch.mjs');
    const code = readFileSync(file, 'utf8');
    const mod = (await import(pathToFileURL(file).href)) as { GOING_CHECKIN_ENABLED: boolean };
    return { code, on: mod.GOING_CHECKIN_ENABLED };
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('going switch in a real Vite build with the repo define', () => {
  it.each([
    ['production + flag true', { VERCEL_ENV: 'production', VITE_ENABLE_GOING_PREVIEW: 'true' }, false],
    ['production + flag true + faked VITE_VERCEL_ENV=preview', { VERCEL_ENV: 'production', VITE_ENABLE_GOING_PREVIEW: 'true', VITE_VERCEL_ENV: 'preview' }, false],
    ['preview + flag true', { VERCEL_ENV: 'preview', VITE_ENABLE_GOING_PREVIEW: 'true' }, true],
    ['preview + flag false', { VERCEL_ENV: 'preview', VITE_ENABLE_GOING_PREVIEW: 'false' }, false],
    ['preview, no flag', { VERCEL_ENV: 'preview' }, false],
    ['local build, flag true', { VITE_ENABLE_GOING_PREVIEW: 'true' }, false],
  ] as const)('%s -> %s', async (_label, env, on) => {
    const tag = _label.replace(/\W+/g, '-');
    const out = await buildSwitch(env, tag);
    expect(out.on).toBe(on);
    expect(out.code).not.toMatch(/import\.meta\.env/);
    // The client sees Vercel's VERCEL_ENV, never a VITE_VERCEL_ENV the shell set.
    expect(out.code).toContain(`vercelEnv: ${JSON.stringify((env as { VERCEL_ENV?: string }).VERCEL_ENV ?? '')}`);
  }, 60_000);
});
