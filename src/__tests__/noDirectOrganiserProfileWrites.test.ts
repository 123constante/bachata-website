import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Organiser profiles are written ONLY via organiser_profile_update_p5_v1.
// \s spans newlines, so the chained multi-line form is caught too.
const DIRECT_WRITE = /\.from\(\s*['"`]organiser_profiles['"`]\s*\)\s*\.(update|insert|upsert|delete)\s*\(/;

const SRC = path.resolve(__dirname, '..');

const collect = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return collect(full);
    if (!/\.(ts|tsx|js|jsx)$/.test(e.name) || e.name.endsWith('.d.ts')) return [];
    if (full.split(path.sep).join('/').endsWith('src/integrations/supabase/types.ts')) return [];
    if (full === __filename) return [];
    return [full];
  });

describe('no direct organiser_profiles writes', () => {
  it('flags a synthetic multi-line write', () => {
    expect(DIRECT_WRITE.test("supabase\n  .from('organiser_profiles')\n  .upsert({})")).toBe(true);
  });
  it('passes a select', () => {
    expect(DIRECT_WRITE.test(".from('organiser_profiles').select('id')")).toBe(false);
  });
  it('finds none in src', () => {
    const files = collect(SRC);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.filter((f) => DIRECT_WRITE.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
