import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The organiser module root, as forward-slash relative paths from it. */
export const MODULE_ROOT = join(process.cwd(), 'src', 'modules', 'organiser');

export function isTestFile(rel: string): boolean {
  return rel.split('/').includes('__tests__') || /\.test\.tsx?$/.test(rel);
}

/** Every .ts / .tsx source file in the module (tests excluded), relative to MODULE_ROOT. */
export function moduleSources(): string[] {
  return (readdirSync(MODULE_ROOT, { recursive: true }) as string[])
    .map((p) => p.split(sep).join('/'))
    .filter((p) => /\.tsx?$/.test(p) && !isTestFile(p))
    .sort();
}

export function readModuleFile(rel: string): string {
  return readFileSync(join(MODULE_ROOT, rel), 'utf8');
}

export function relFromModule(abs: string): string {
  return relative(MODULE_ROOT, abs).split(sep).join('/');
}
