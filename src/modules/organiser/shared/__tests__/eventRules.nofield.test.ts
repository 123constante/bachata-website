/**
 * Rule 1: no start-time input anywhere in the organiser module. RATCHET: today's
 * offenders are listed below. A NEW file that takes a time input fails; a listed
 * file that no longer does fails too (delete its line), so the list only shrinks.
 * C7/C8/C9 remove the listed screens; this is red-by-design until the list is empty,
 * and never passes silently.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const TIME_INPUT = /type=["']time["']|type:\s*["']time["']|<TimeField\b|<TimePicker\b/;

/** Offenders as of ER-S1 (2026-10-21), module-relative. */
const OFFENDERS = new Set<string>([
  'dates/DateSheet.tsx',
  'flows/add/Time.tsx',
  'flows/change/Time.tsx',
  'flows/new/NewFlow.tsx',
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe('no time input in the organiser module (ratchet)', () => {
  const found = walk(ROOT)
    .filter((f) => TIME_INPUT.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f).split('\\').join('/'))
    .sort();
  it('no NEW file takes a time input', () => {
    expect(found.filter((f) => !OFFENDERS.has(f))).toEqual([]);
  });
  it('every listed offender still does (remove the line when you remove the input)', () => {
    expect([...OFFENDERS].filter((f) => !found.includes(f)).sort()).toEqual([]);
  });
});
