/**
 * Parity: the guard's genre mapping (scripts/check-event-truth-v1.mjs, CI #70) and the
 * canonical derivation (src/lib/eventCategory.ts, byte-pinned to admin) answer the SAME over
 * ONE shared fixture, scripts/fixtures/event-truth-parity.json. The guard's --self-test runs
 * every case through its deriveGenres/categoryAgrees; this file runs the same cases through
 * deriveCategories/categoryAgrees. Mutate one mapping and only its side reds.
 *
 * A shared JSON rather than an import: vitest cannot load the guard (.mjs with a CRLF
 * shebang), and the lib must stay dependency-free so both repos hold the same bytes.
 * Date-only sessions enter the lib as extra kinds and types, which is exactly how every
 * caller feeds them (section_kind -> kinds, type -> types).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryAgrees, deriveCategories } from '../eventCategory';

interface ParityCase {
  name: string;
  format: string | null;
  sectionKinds: Array<string | null>;
  itemTypes: Array<string | null>;
  addedSessions: Array<{ kind: string | null; type: string | null }>;
  stored: string | null;
  expect: { set: string[]; agrees: boolean };
}

const FIXTURE = resolve(__dirname, '../../../scripts/fixtures/event-truth-parity.json');
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as { _comment: string; cases: ParityCase[] };

describe('event-truth parity fixture (shared with check-event-truth-v1.mjs --self-test)', () => {
  it('is well-formed: at least 15 cases, each with the pinned keys', () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(15);
    for (const c of fixture.cases) {
      expect(Object.keys(c).sort()).toEqual(['addedSessions', 'expect', 'format', 'itemTypes', 'name', 'sectionKinds', 'stored']);
      for (const a of c.addedSessions) expect(Object.keys(a).sort()).toEqual(['kind', 'type']);
      // `stored` null is deliberately absent: the two sides read NULL differently by design.
      expect(c.stored).not.toBeNull();
    }
    expect(new Set(fixture.cases.map((c) => c.name)).size).toBe(fixture.cases.length);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const kinds = [...c.sectionKinds, ...c.addedSessions.map((a) => a.kind)];
    const types = [...c.itemTypes, ...c.addedSessions.map((a) => a.type)];
    const { set } = deriveCategories(c.format, kinds, types);
    expect([...set].sort()).toEqual([...c.expect.set].sort());
    expect(categoryAgrees(c.stored, set)).toBe(c.expect.agrees);
  });
});
