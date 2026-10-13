import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryAgrees, deriveCategories } from '../eventCategory';

/**
 * PARITY with the CI guard (scripts/check-event-truth-v1.mjs, CI #70). The guard keeps
 * its own JS copy of the derivation (deriveGenres / categoryAgrees) because vitest
 * cannot import its CRLF-shebang .mjs; so the two sides share ONE corpus,
 * scripts/fixtures/event-truth-parity.json, and each runs every case. The guard's
 * --self-test is the other half. A mapping edited on one side only reds that side
 * only -- proved by mutation on 2026-10-13 (docs/handover/event-truth-p3-guard.md).
 *
 * Date-only sessions (event_occurrence_added_session_p5: section_kind + type) are
 * folded into the kind and type lists, which is exactly how the organiser screens
 * call deriveCategories (event-truth P3, admin #780).
 */
interface ParityCase {
  name: string;
  format: string | null;
  sectionKinds: Array<string | null>;
  itemTypes: Array<string | null>;
  addedSessions: Array<{ kind: string | null; type: string | null }>;
  stored: string | null;
  expect: { set: string[]; agrees: boolean };
}

const CORPUS = resolve(__dirname, '../../../scripts/fixtures/event-truth-parity.json');
const parity = JSON.parse(readFileSync(CORPUS, 'utf8')) as { cases: ParityCase[] };

describe('parity corpus: the canonical lib agrees with the CI guard, case by case', () => {
  it('holds at least 15 cases, each well-formed (a thin corpus proves little)', () => {
    expect(parity.cases.length).toBeGreaterThanOrEqual(15);
    for (const c of parity.cases) {
      expect(typeof c.name).toBe('string');
      expect(Array.isArray(c.sectionKinds)).toBe(true);
      expect(Array.isArray(c.itemTypes)).toBe(true);
      expect(Array.isArray(c.addedSessions)).toBe(true);
      for (const a of c.addedSessions) expect(Object.keys(a).sort()).toEqual(['kind', 'type']);
      expect(Array.isArray(c.expect.set)).toBe(true);
      expect(typeof c.expect.agrees).toBe('boolean');
    }
  });

  it.each(parity.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const { set } = deriveCategories(
      c.format,
      [...c.sectionKinds, ...c.addedSessions.map((a) => a.kind)],
      [...c.itemTypes, ...c.addedSessions.map((a) => a.type)],
    );
    expect(set).toEqual(c.expect.set);
    expect(categoryAgrees(c.stored, set)).toBe(c.expect.agrees);
  });
});
